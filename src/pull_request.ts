import { info, warning } from "@actions/core";
import config from "./config";
import { initOctokit } from "./octokit";
import { loadContext } from "./context";
import runSummaryPrompt, { AIComment, runReviewPrompt } from "./prompts";
import {
  buildLoadingMessage,
  buildWalkthroughMessage,
  OVERVIEW_MESSAGE_SIGNATURE,
  PAYLOAD_TAG_CLOSE,
  PAYLOAD_TAG_OPEN,
} from "./messages";
import { generateIncrementalDiff, parseFileDiff } from "./diff";
import { Octokit } from "@octokit/action";
import { Context } from "@actions/github/lib/context";

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

  const octokit = initOctokit(config.githubToken);

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
  const reviewComments = isIncrementalReview
    ? (
        await octokit.rest.pulls.listReviewComments({
          ...context.repo,
          pull_number: pull_request.number,
        })
      ).data
    : [];

  // Get modified files
  const { data: files } = await octokit.rest.pulls.listFiles({
    ...context.repo,
    pull_number: pull_request.number,
  });
  let filesToReview = files.map((file) => parseFileDiff(file, reviewComments));
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
      filesToReview = generateIncrementalDiff(
        incrementalDiff.data.files,
        filesToReview
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

  if (overviewComment) {
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
  if (pull_request.title.includes("@presubmitai")) {
    info(`title contains @presubmitai, so generating a new title`);
    await octokit.rest.pulls.update({
      ...context.repo,
      pull_number: pull_request.number,
      title: summary.title,
      // body: summary.description,
    });
  }

  // Update overview comment with the walkthrough
  await octokit.rest.issues.updateComment({
    ...context.repo,
    comment_id: overviewComment.id,
    body: buildWalkthroughMessage(
      summary,
      commits.map((c) => c.sha)
    ),
  });
  info(`updated overview comment with walkthrough`);

  // ======= START REVIEW =======

  const review = await runReviewPrompt({
    files: filesToReview,
    prTitle: pull_request.title,
    prDescription: pull_request.body || "",
    prSummary: summary.description,
  });
  console.log("Review: ", review.review);
  console.log("Comments: ", review.comments);
  info(`reviewed pull request`);

  // Post review comments
  const comments = review.comments.filter(
    (c) => c.content.trim() !== "" && files.some((f) => f.filename === c.file)
  );
  await submitReview(
    octokit,
    context,
    {
      number: pull_request.number,
      headSha: pull_request.head.sha,
    },
    comments
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
  comments: AIComment[]
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
      body: content,
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
  const lineComments = comments.filter((c) => !!c.end_line);

  // Try to submit all comments at once
  try {
    let commentsData = lineComments.map((c) => ({
      path: c.file,
      body: c.content,
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
      body: "Review complete",
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
