import { warning, setFailed } from '@actions/core';
import { handlePullRequest } from './pull_request';
import { handlePullRequestComment } from './pull_request_comment';

async function main(): Promise<void> {
  try {
    switch (process.env.GITHUB_EVENT_NAME) {
      case 'pull_request':
      case 'pull_request_target':
        handlePullRequest();
        break;
      case 'pull_request_review_comment':
        handlePullRequestComment();
        break;
      default:
        warning('Skipped: unsupported github event');
    }
  } catch (error) {
    setFailed(`Failed with error: ${error instanceof Error ? error.message : error}`);
  }
}

main();
