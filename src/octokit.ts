import { warning } from "@actions/core";
import { Octokit } from "@octokit/action";
import { retry } from "@octokit/plugin-retry";
import { throttling } from "@octokit/plugin-throttling";

interface ThrottleOptions {
  method: string;
  url: string;
}

const SmartOctokit = Octokit.plugin(throttling, retry);

export function initOctokit(token?: string, apiBaseUrl?: string): Octokit {
  if (!token) {
    throw new Error("GitHub token is required but was not provided");
  }

  return new SmartOctokit({
    auth: token,
    baseUrl: apiBaseUrl,
    throttle: {
      onRateLimit: (
        retryAfter: number,
        options: ThrottleOptions,
        _: any,
        retryCount: number
      ) => {
        warning(
          `Rate limited for request ${options.method} ${options.url}\n` +
            `Retry after: ${retryAfter} seconds\n` +
            `Retry count: ${retryCount}`
        );

        // Return true to retry, false to give up
        return retryCount <= 3;
      },

      onSecondaryRateLimit: (retryAfter: number, options: ThrottleOptions) => {
        warning(
          `Secondary rate limited for request ${options.method} ${options.url}\n` +
            `Retry after: ${retryAfter} seconds`
        );

        // Don't retry POST requests for pull request reviews
        if (
          options.method === "POST" &&
          options.url.match(/\/repos\/[^/]+\/[^/]+\/pulls\/\d+\/reviews/)
        ) {
          return false;
        }

        return true;
      },
    },
  });
}
