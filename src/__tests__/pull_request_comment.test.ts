// Add these mock imports at the top of the file
jest.mock('@octokit/action');
jest.mock('@octokit/plugin-retry');
jest.mock('@octokit/plugin-throttling');

import { handlePullRequestComment } from '../pull_request_comment';
import { loadContext } from '../context';
import { initOctokit } from '../octokit';
import { getCommentThread, isOwnComment, isThreadRelevant } from '../comments';
import { runReviewCommentPrompt } from '../prompts';
import config from '../config';

// Mock dependencies
jest.mock('../context');
jest.mock('../octokit');
jest.mock('../comments');
jest.mock('../prompts');
jest.mock('../config', () => ({
  __esModule: true,
  default: {
    githubToken: 'mock-token',
    llmApiKey: 'mock-api-key',
    llmModel: 'mock-model',
    styleGuideRules: '',
    githubApiUrl: 'https://api.github.com',
    githubServerUrl: 'https://github.com',
    loadInputs: jest.fn(),
  },
}));
jest.mock('@actions/core', () => ({
  info: jest.fn(),
  warning: jest.fn(),
}));

describe('Pull Request Comment Handler', () => {
  beforeEach(() => {
    jest.resetAllMocks();

    // Mock context
    (loadContext as jest.Mock).mockResolvedValue({
      eventName: 'pull_request_review_comment',
      repo: { owner: 'test-owner', repo: 'test-repo' },
      payload: {
        action: 'created',
        comment: {
          id: 123,
          body: 'Test comment',
          user: { login: 'test-user' },
        },
        pull_request: {
          number: 456,
          head: { sha: 'head-sha' },
        },
      },
    });

    // Mock octokit with correct structure including 'rest'
    const mockOctokit = {
      rest: {
        pulls: {
          listFiles: jest.fn().mockResolvedValue({
            data: [
              { filename: 'test.ts', status: 'modified', patch: '@@ -1,1 +1,2 @@\n test\n+added' },
            ],
          }),
          createReviewComment: jest.fn().mockResolvedValue({}),
        },
      },
    };
    (initOctokit as jest.Mock).mockReturnValue(mockOctokit);

    // Mock comment thread
    (getCommentThread as jest.Mock).mockResolvedValue({
      file: 'test.ts',
      comments: [
        {
          id: 123,
          body: 'Test comment',
          user: { login: 'test-user' },
          path: 'test.ts',
          line: 2,
          diff_hunk: '@@ -1,1 +1,2 @@\n test\n+added',
        },
      ],
    });

    (isOwnComment as jest.Mock).mockReturnValue(false);
    (isThreadRelevant as jest.Mock).mockReturnValue(true);

    // Mock prompt response
    (runReviewCommentPrompt as jest.Mock).mockResolvedValue({
      response_comment: 'AI response to comment',
      action_requested: true,
    });
  });

  test('handles pull request comment event correctly', async () => {
    await handlePullRequestComment();

    // Verify context was loaded
    expect(loadContext).toHaveBeenCalled();

    // Verify octokit was initialized
    expect(initOctokit).toHaveBeenCalled();

    // Verify comment thread was fetched
    expect(getCommentThread).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 456,
        comment_id: 123,
      }),
    );

    // Get the mock octokit instance
    const mockOctokit = (initOctokit as jest.Mock).mock.results[0].value;

    // Verify that listFiles is called with the correct parameters
    expect(mockOctokit.rest.pulls.listFiles).toHaveBeenCalledWith({
      owner: 'test-owner',
      repo: 'test-repo',
      pull_number: 456,
    });

    // Verify prompt was called
    expect(runReviewCommentPrompt).toHaveBeenCalled();

    // Verify response was posted
    expect(mockOctokit.rest.pulls.createReviewComment).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 456,
        path: 'test.ts',
        in_reply_to: 123,
      }),
    );
  });

  test('ignores own comments', async () => {
    (isOwnComment as jest.Mock).mockReturnValue(true);

    await handlePullRequestComment();

    // Verify context was loaded
    expect(loadContext).toHaveBeenCalled();

    // Verify no further processing happened
    expect(getCommentThread).not.toHaveBeenCalled();
    expect(runReviewCommentPrompt).not.toHaveBeenCalled();
  });

  test('ignores irrelevant comment threads', async () => {
    (isThreadRelevant as jest.Mock).mockReturnValue(false);

    await handlePullRequestComment();

    // Verify context was loaded
    expect(loadContext).toHaveBeenCalled();
    expect(getCommentThread).toHaveBeenCalled();

    // Verify no further processing happened
    expect(runReviewCommentPrompt).not.toHaveBeenCalled();
  });

  test('skips response when no action requested', async () => {
    (runReviewCommentPrompt as jest.Mock).mockResolvedValue({
      response_comment: 'AI response to comment',
      action_requested: false,
    });

    await handlePullRequestComment();

    // Verify prompt was called
    expect(runReviewCommentPrompt).toHaveBeenCalled();

    // Verify no response was posted
    const mockOctokit = (initOctokit as jest.Mock).mock.results[0].value;
    expect(mockOctokit.rest.pulls.createReviewComment).not.toHaveBeenCalled();
  });
});
