import { info, warning } from "@actions/core";
import config from "./config";
import { initOctokit } from "./octokit";
import { loadContext } from "./context";
import { runSummaryPrompt, AIComment, runReviewPrompt as runReviewPromptCore } from "./prompts";
import { runReviewPrompt as runReviewPromptCustom } from "./prompts.custom";
import {
  buildLoadingMessage,
  buildReviewSummary,
  buildOverviewMessage,
  OVERVIEW_MESSAGE_SIGNATURE,
  PAYLOAD_TAG_CLOSE,
  PAYLOAD_TAG_OPEN,
} from "./messages";
import { FileDiff, parseFileDiff } from "./diff";
import { Octokit } from "@octokit/action";
import { Context } from "@actions/github/lib/context";
import { buildComment, listPullRequestCommentThreads } from "./comments";

const IS_DRY_RUN = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

export async function handlePullRequest() {
  const context = await loadContext();
  if (
    context.eventName !== "pull_request" &&
    context.eventName !== "pull_request_target"
  ) {
    warning("unsupported github event");
    return;
  }

  const { pull_request } = context.payload;
  if (!pull_request) {
    warning("`pull_request` is missing from payload");
    return;
  }

  const octokit = initOctokit(config.githubToken, config.githubApiUrl);

  if (shouldIgnorePullRequest(pull_request)) {
    return;
  }

  // Get commit messages
  const { data: commits } = await octokit.rest.pulls.listCommits({
    ...context.repo,
    pull_number: pull_request.number,
  });
  info(`successfully fetched commit messages`);

  // Find or create overview comment with the summary
  const { data: existingComments } = await octokit.rest.issues.listComments({
    ...context.repo,
    issue_number: pull_request.number,
  });
  let overviewComment = existingComments.find((comment) =>
    comment.body?.includes(OVERVIEW_MESSAGE_SIGNATURE)
  );
  const isIncrementalReview = !!overviewComment;

  // Maybe fetch review comments
  const reviewCommentThreads = isIncrementalReview
    ? await listPullRequestCommentThreads(octokit, {
        ...context.repo,
        pull_number: pull_request.number,
      })
    : [];

  // Get modified files
  const { data: files } = await octokit.rest.pulls.listFiles({
    ...context.repo,
    pull_number: pull_request.number,
  });
  let filesToReview = files.map((file) =>
    parseFileDiff(file, reviewCommentThreads)
  );
  info(`successfully fetched file diffs`);

  let commitsReviewed: string[] = [];
  let lastCommitReviewed: string | null = null;
  if (overviewComment) {
    info(`running incremental review`);
    try {
      const payload = JSON.parse(
        overviewComment.body
          ?.split(PAYLOAD_TAG_OPEN)[1]
          .split(PAYLOAD_TAG_CLOSE)[0] || "{}"
      );
      commitsReviewed = payload.commits;
    } catch (error) {
      warning(`error parsing overview payload: ${error}`);
    }

    // Check if there are any incremental changes
    lastCommitReviewed =
      commitsReviewed.length > 0
        ? commitsReviewed[commitsReviewed.length - 1]
        : null;
    const incrementalDiff =
      lastCommitReviewed && lastCommitReviewed != pull_request.head.sha
        ? await octokit.rest.repos.compareCommits({
            ...context.repo,
            base: lastCommitReviewed,
            head: pull_request.head.sha,
          })
        : null;
    if (incrementalDiff?.data?.files) {
      // If incremental review, only consider files that were modified within incremental change.
      filesToReview = filesToReview.filter((f) =>
        incrementalDiff.data.files?.some((f2) => f2.filename === f.filename)
      );
    }
  } else {
    info(`running full review`);
  }

  const commitsToReview = commitsReviewed.length
    ? commits.filter((c) => !commitsReviewed.includes(c.sha))
    : commits;
  if (commitsToReview.length === 0) {
    info(`no new commits to review`);
    return;
  }

  if (IS_DRY_RUN) {
    const body = buildLoadingMessage(
      (lastCommitReviewed ?? pull_request.base.sha),
      commitsToReview,
      filesToReview
    );
    info(`DRY-RUN: would ${overviewComment ? 'update' : 'create'} overview loading comment`);
    console.log(body);
  } else if (overviewComment) {
    await octokit.rest.issues.updateComment({
      ...context.repo,
      comment_id: overviewComment.id,
      body: buildLoadingMessage(
        lastCommitReviewed ?? pull_request.base.sha,
        commitsToReview,
        filesToReview
      ),
    });
    info(`updated existing overview comment`);
  } else {
    overviewComment = (
      await octokit.rest.issues.createComment({
        ...context.repo,
        issue_number: pull_request.number,
        body: buildLoadingMessage(
          pull_request.base.sha,
          commitsToReview,
          filesToReview
        ),
      })
    ).data;
    info(`posted new overview loading comment`);
  }

  // Generate PR summary
  const summary = await runSummaryPrompt({
    prTitle: pull_request.title,
    prDescription: pull_request.body || "",
    commitMessages: commits.map((commit) => commit.commit.message),
    files: files,
  });
  info(`generated pull request summary: ${summary.title}`);

  // Update PR title if @presubmitai is mentioned in the title
  if (
    pull_request.title.includes("@presubmitai") ||
    pull_request.title.includes("@presubmit")
  ) {
    info(`title contains mention of presubmit.ai, so generating a new title`);
    if (IS_DRY_RUN) {
      info(`DRY-RUN: would update PR title to: ${summary.title}`);
    } else {
      await octokit.rest.pulls.update({
        ...context.repo,
        pull_number: pull_request.number,
        title: summary.title,
        // body: summary.description,
      });
    }
  }

  // Update overview comment with the PR overview
  const walkthroughBody = buildOverviewMessage(
    summary,
    commits.map((c: any) => c.sha)
  );
  if (IS_DRY_RUN) {
    info(`DRY-RUN: would update overview comment with walkthrough`);
    console.log(walkthroughBody);
  } else if (overviewComment) {
    await octokit.rest.issues.updateComment({
      ...context.repo,
      comment_id: overviewComment.id,
      body: walkthroughBody,
    });
    info(`updated overview comment with walkthrough`);
  }

  // ======= START REVIEW =======

  // Batch files by character count to avoid exceeding LLM context limits
  const batchFilesByChars = (files: FileDiff[], maxChars: number): FileDiff[][] => {
    const batches: FileDiff[][] = [];
    let current: FileDiff[] = [];
    let size = 0;
    const estimate = (f: FileDiff) => {
      const hunksSize = f.hunks.reduce((acc, h) => acc + (h.diff?.length || 0), 0);
      // add overhead for headers/markup
      return hunksSize + (f.filename?.length || 0) + 200;
    };
    for (const f of files) {
      const s = estimate(f);
      if (current.length && size + s > maxChars) {
        batches.push(current);
        current = [];
        size = 0;
      }
      current.push(f);
      size += s;
    }
    if (current.length) batches.push(current);
    return batches;
  };

  const batches = batchFilesByChars(filesToReview, config.maxReviewChars);
  info(`split ${filesToReview.length} files into ${batches.length} batch(es) for review`);

  let allComments: AIComment[] = [];
  let firstReviewDoc: string | undefined;

  for (const batch of batches) {
    const testing = process.env.NODE_ENV === 'test';
    const hasProvider = !!(config as any).llmProvider && !!(config as any).llmModel;
    const allowCustom = !testing && hasProvider;
    const useCustom = allowCustom && shouldUseCustomMode(batch, config.customMode);
    const runner = useCustom ? runReviewPromptCustom : runReviewPromptCore;
    const part = await runner({
      files: batch,
      prTitle: pull_request.title,
      prDescription: pull_request.body || "",
      prSummary: summary.description,
    });
    if (part?.comments?.length) allComments.push(...part.comments);
    const maybeDoc: unknown = (part as any)?.documentation;
    if (!firstReviewDoc && typeof maybeDoc === 'string' && maybeDoc.trim()) {
      firstReviewDoc = maybeDoc.trim();
    }
  }
  info(`reviewed pull request in ${batches.length} batch(es)`);

  // Post review comments
  const comments = allComments.filter(
    (c) => typeof c.content === 'string' && c.content.trim() !== "" && files.some((f: any) => f.filename === c.file)
  );

  // Update overview comment with documentation if available
  if (firstReviewDoc && overviewComment) {
    try {
      const combinedBody = buildOverviewMessage(
        summary,
        commits.map((c: any) => c.sha),
        firstReviewDoc
      );
      if (IS_DRY_RUN) {
        info(`DRY-RUN: would update overview with documentation`);
        console.log(combinedBody);
      } else {
        await octokit.rest.issues.updateComment({
          ...context.repo,
          comment_id: overviewComment.id,
          body: combinedBody,
        });
        info(`updated overview comment with documentation`);
      }
    } catch (e) {
      warning(`error updating overview comment with documentation: ${e}`);
    }
  }

  if (IS_DRY_RUN) {
    info(`DRY-RUN: would submit review with ${comments.length} inline comments`);
    const finalBody = buildOverviewMessage(
      summary,
      commits.map((c: any) => c.sha),
      firstReviewDoc
    );
    console.log('=== Final Overview (dry-run) ===');
    console.log(finalBody);
    if (comments.length) {
      console.log('=== Inline Comments (dry-run) ===');
      for (const c of comments) {
        const range = c.start_line && c.end_line ? `${c.start_line}-${c.end_line}` : `${c.end_line ?? ''}`;
        console.log(`• ${c.file}:${range} ${c.label ? '['+c.label+'] ' : ''}${c.critical ? '(critical) ' : ''}\n${c.content}\n`);
      }
    }
    return;
  }

  await submitReview(
    octokit,
    context,
    {
      number: pull_request.number,
      headSha: pull_request.head.sha,
    },
    comments,
    commitsToReview,
    filesToReview
  );
  info(`posted review comments`);
}

async function submitReview(
  octokit: Octokit,
  context: Context,
  pull_request: {
    number: number;
    headSha: string;
  },
  comments: AIComment[],
  commits: {
    sha: string;
    commit: {
      message: string;
    };
  }[],
  files: FileDiff[]
) {
  const submitInlineComment = async (
    file: string,
    line: number,
    content: string
  ) => {
    await octokit.pulls.createReviewComment({
      ...context.repo,
      pull_number: pull_request.number,
      commit_id: pull_request.headSha,
      path: file,
      body: buildComment(content),
      line,
    });
  };

  // Handle file comments
  const fileComments = comments.filter((c) => !c.end_line);
  if (fileComments.length > 0) {
    const responses = await Promise.allSettled(
      fileComments.map((c) => submitInlineComment(c.file, -1, c.content))
    );

    for (const response of responses) {
      if (response.status === "rejected") {
        warning(`error creating file comment: ${response.reason}`);
      }
    }
  }

  // Handle line comments
  let lineComments = [];
  let skippedComments = [];
  for (const comment of comments) {
    if (comment.critical || comment.label === "typo") {
      lineComments.push(comment);
    } else {
      skippedComments.push(comment);
    }
  }

  // Try to submit all comments at once
  try {
    let commentsData = lineComments.map((c) => ({
      path: c.file,
      body: buildComment(c.content),
      line: c.end_line,
      side: "RIGHT",
      start_line:
        c.start_line && c.start_line < c.end_line ? c.start_line : undefined,
      start_side:
        c.start_line && c.start_line < c.end_line ? "RIGHT" : undefined,
    }));

    const review = await octokit.pulls.createReview({
      ...context.repo,
      pull_number: pull_request.number,
      commit_id: pull_request.headSha,
      comments: commentsData,
    });

    await octokit.pulls.submitReview({
      ...context.repo,
      pull_number: pull_request.number,
      review_id: review.data.id,
      event: "COMMENT",
      body: buildReviewSummary(
        context,
        files,
        commits,
        lineComments,
        skippedComments
      ),
    });
  } catch (error) {
    warning(`error submitting review: ${error}`);

    // If submitting all comments at once fails, try submitting them one by one
    info("trying to submit comments one by one");
    await Promise.allSettled(
      lineComments.map((c) =>
        submitInlineComment(c.file, c.end_line, c.content)
      )
    );
  }
}

function isComplexCodeFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  const complexExtensions = [
    ".py", ".js", ".ts", ".java", ".scala", ".kt", ".cs", ".cpp", ".cc", ".cxx",
    ".go", ".rs", ".rb", ".php", ".swift", ".m", ".mm", ".dart", ".ex", ".exs"
  ];
  return complexExtensions.some((ext) => lower.endsWith(ext));
}

function shouldUseCustomMode(files: FileDiff[], mode?: string): boolean {
  const m = (mode || "auto").toLowerCase();
  if (m === "on") return true;
  if (m === "off") return false;
  // In auto mode, use custom enhanced review for complex code files
  return files.some((f) => isComplexCodeFile(f.filename));
}

function shouldIgnorePullRequest(pull_request: { body?: string }) {
  const ignorePhrases = [
    "@presubmit ignore",
    "@presubmit: ignore",
    "@presubmit skip",
    "@presubmit: skip",
    "@presubmitai ignore",
    "@presubmitai: ignore",
    "@presubmitai skip",
    "@presubmitai: skip",
  ];
  const bodyLower = (pull_request.body ?? "").toLowerCase();

  for (const phrase of ignorePhrases) {
    if (bodyLower.includes(phrase.toLowerCase())) {
      info(`ignoring pull request because of '${phrase}' in description`);
      return true;
    }
  }
  return false;
}
