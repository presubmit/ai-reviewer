import { Octokit } from "@octokit/rest";

export function getGithubClient() {
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

  return octokit;
}
