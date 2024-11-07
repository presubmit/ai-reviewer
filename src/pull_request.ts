import { warning } from "@actions/core";
import { Config } from "./config";
import { initOctokit } from "./octokit";
import { loadContext } from "./context";

export async function handlePullRequest(config: Config) {
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

  // Get PR files
  const { data: files } = await octokit.rest.pulls.listFiles({
    ...context.repo,
    pull_number: pull_request.number,
  });

  console.log("files: ", files);
  console.log("pull_request: ", pull_request);

  return {
    title: pull_request.title,
    description: pull_request.body || "",
    files: files.map((file) => ({
      filename: file.filename,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      patch: file.patch,
    })),
  };
}
