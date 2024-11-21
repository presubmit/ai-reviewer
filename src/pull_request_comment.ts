import { info, warning } from "@actions/core";
import { loadContext } from "./context";
import config from "./config";
import { initOctokit } from "./octokit";
import { getCommentThread, isOwnComment } from "./comments";
import { parseFileDiff } from "./diff";
import { runReviewCommentPrompt } from "./prompts";

export async function handlePullRequestComment() {
  const context = await loadContext();
  if (context.eventName !== "pull_request_review_comment") {
    warning("unsupported github event");
    return;
  }

  const { comment, pull_request } = context.payload;
  if (!comment) {
    warning("`comment` is missing from payload");
    return;
  }
  if (context.payload.action !== "created") {
    warning("only consider newly created comments");
    return;
  }
  if (!pull_request) {
    warning("`pull_request` is missing from payload");
    return;
  }
  if (isOwnComment(comment.body)) {
    info("ignoring own comments");
    return;
  }

  const octokit = initOctokit(config.githubToken);

  // Fetch comment thread
  const commentThread = await getCommentThread(octokit, {
    ...context.repo,
    pull_number: pull_request.number,
    comment_id: comment.id,
  });
  if (!commentThread) {
    warning("comment thread not found");
    return;
  }

  // Fetch diffs for all files
  const { data: files } = await octokit.rest.pulls.listFiles({
    ...context.repo,
    pull_number: pull_request.number,
  });
  let fileDiffs = files.map((file) => parseFileDiff(file, []));

  // Find the file that the comment is in
  const commentFileDiff = fileDiffs.find(
    (fileDiff) => fileDiff.filename === commentThread.file
  );
  if (!commentFileDiff) {
    warning("comment is not in any file that was changed in this PR");
    return;
  }

  const response = await runReviewCommentPrompt({
    commentThread,
    commentFileDiff,
  });

  if (response.action_requested && response.response_comment.length) {
    info("action requested, submitting response");

    await octokit.pulls.createReviewComment({
      ...context.repo,
      pull_number: pull_request.number,
      commit_id: pull_request.headSha,
      path: commentThread.file,
      body: response.response_comment,
      in_reply_to: commentThread.comments[0].id,
    });
  } else {
    info(
      "comment doesn't seem to require any action, so not submitting a response"
    );
  }
}
