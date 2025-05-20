import { context, getOctokit } from "@actions/github";
import { Context } from "@actions/github/lib/context";

export async function loadContext(): Promise<Context> {
  if (process.env.DEBUG) {
    return await loadDebugContext();
  }
  return context;
}

async function loadDebugContext(): Promise<Context> {
  if (!process.env.GITHUB_TOKEN) {
    throw new Error("GITHUB_TOKEN is not set");
  }
  const baseUrl = process.env.GITHUB_API_URL || undefined;
  const octokit = getOctokit(process.env.GITHUB_TOKEN, { baseUrl });

  const [owner, repo] = process.env.GITHUB_REPOSITORY?.split("/") || [];

  const { data: pull_request } = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: parseInt(process.env.GITHUB_PULL_REQUEST || "1"),
  });

  const commentId = process.env.GITHUB_COMMENT_ID;
  let comment: any;
  if (commentId) {
    const { data } = await octokit.rest.pulls.getReviewComment({
      owner,
      repo,
      comment_id: parseInt(commentId),
    });
    comment = data;
  }

  return {
    ...context,
    eventName: process.env.GITHUB_EVENT_NAME || "",
    repo: {
      owner,
      repo,
    },
    payload: {
      action: process.env.GITHUB_EVENT_ACTION || "",
      pull_request: {
        ...pull_request,
        number: pull_request.number,
        html_url: pull_request.html_url,
        body: pull_request.body || undefined,
      },
      comment,
    },
    issue: context.issue,
  };
}
