import { warning } from "@actions/core";
import { Octokit } from "@octokit/action";
import { retry } from "@octokit/plugin-retry";
import { throttling } from "@octokit/plugin-throttling";

const SmartOctokit = Octokit.plugin(throttling, retry);

export const initOctokit = (token?: string) => {
  if (!token) {
    throw new Error("No github token");
  }
  return new SmartOctokit({
    auth: `token ${token}`,
    throttle: {
      onRateLimit: (
        retryAfter: any,
        options: { method: any; url: any },
        _unused_octokit: any,
        retryCount: number
      ) => {
        warning(
          `Rate limited for request ${options.method} ${options.url}
Retry after: ${retryAfter} seconds
Retry count: ${retryCount}
`
        );
        if (retryCount <= 3) {
          warning(`Retrying after ${retryAfter} seconds!`);
          return true;
        }
      },
      onSecondaryRateLimit: (retryAfter: number, options: any) => {
        warning(
          `Secondary rate limited for request ${options.method} ${options.url}
Retry after: ${retryAfter} seconds`
        );
        // Do not retry POST requests on /repos/{owner}/{repo}/pulls/{pull_number}/reviews
        if (
          options.method === "POST" &&
          options.url.match(/\/repos\/.*\/.*\/pulls\/.*\/reviews/)
        ) {
          return false;
        }
        return true;
      },
    },
  });
};
