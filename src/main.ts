import { warning, setFailed } from "@actions/core";
import { Config } from "./config";
import { handlePullRequest } from "./pull_request";
async function main(): Promise<void> {
  try {
    const config = new Config();
    config.loadInputs();

    switch (process.env.GITHUB_EVENT_NAME) {
      case "pull_request":
      case "pull_request_target":
        handlePullRequest(config);
        break;
      case "pull_request_review_comment":
        break;
      default:
        warning("Skipped: unsupported github event");
    }
  } catch (error) {
    setFailed(
      `Failed with error: ${error instanceof Error ? error.message : error}`
    );
  }
}

main();
