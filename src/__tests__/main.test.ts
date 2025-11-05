import { jest } from '@jest/globals';

describe('main entrypoint', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('calls handlePullRequest for pull_request event', async () => {
    process.env.GITHUB_EVENT_NAME = 'pull_request';

    const handlePullRequest = jest.fn();
    const handlePullRequestComment = jest.fn();
    const warning = jest.fn();
    const setFailed = jest.fn();

    jest.doMock('../pull_request', () => ({ __esModule: true, handlePullRequest }));
    jest.doMock('../pull_request_comment', () => ({ __esModule: true, handlePullRequestComment }));
    jest.doMock('@actions/core', () => ({ warning, setFailed }));

    await jest.isolateModulesAsync(async () => {
      await import('../main');
    });

    expect(handlePullRequest).toHaveBeenCalledTimes(1);
    expect(handlePullRequestComment).not.toHaveBeenCalled();
    expect(warning).not.toHaveBeenCalled();
    expect(setFailed).not.toHaveBeenCalled();
  });

  test('calls handlePullRequestComment for pull_request_review_comment event', async () => {
    process.env.GITHUB_EVENT_NAME = 'pull_request_review_comment';

    const handlePullRequest = jest.fn();
    const handlePullRequestComment = jest.fn();
    const warning = jest.fn();
    const setFailed = jest.fn();

    jest.doMock('../pull_request', () => ({ __esModule: true, handlePullRequest }));
    jest.doMock('../pull_request_comment', () => ({ __esModule: true, handlePullRequestComment }));
    jest.doMock('@actions/core', () => ({ warning, setFailed }));

    await jest.isolateModulesAsync(async () => {
      await import('../main');
    });

    expect(handlePullRequestComment).toHaveBeenCalledTimes(1);
    expect(handlePullRequest).not.toHaveBeenCalled();
    expect(warning).not.toHaveBeenCalled();
    expect(setFailed).not.toHaveBeenCalled();
  });

  test('warns for unsupported events', async () => {
    process.env.GITHUB_EVENT_NAME = 'workflow_dispatch';

    const handlePullRequest = jest.fn();
    const handlePullRequestComment = jest.fn();
    const warning = jest.fn();
    const setFailed = jest.fn();

    jest.doMock('../pull_request', () => ({ __esModule: true, handlePullRequest }));
    jest.doMock('../pull_request_comment', () => ({ __esModule: true, handlePullRequestComment }));
    jest.doMock('@actions/core', () => ({ warning, setFailed }));

    await jest.isolateModulesAsync(async () => {
      await import('../main');
    });

    expect(warning).toHaveBeenCalledWith('Skipped: unsupported github event');
    expect(handlePullRequest).not.toHaveBeenCalled();
    expect(handlePullRequestComment).not.toHaveBeenCalled();
    expect(setFailed).not.toHaveBeenCalled();
  });

  test('setFailed is called when handler throws', async () => {
    process.env.GITHUB_EVENT_NAME = 'pull_request';

    const handlePullRequest = jest.fn(() => { throw new Error('boom'); });
    const handlePullRequestComment = jest.fn();
    const warning = jest.fn();
    const setFailed = jest.fn();

    jest.doMock('../pull_request', () => ({ __esModule: true, handlePullRequest }));
    jest.doMock('../pull_request_comment', () => ({ __esModule: true, handlePullRequestComment }));
    jest.doMock('@actions/core', () => ({ warning, setFailed }));

    await jest.isolateModulesAsync(async () => {
      await import('../main');
    });

    expect(setFailed).toHaveBeenCalled();
    expect(setFailed.mock.calls[0][0]).toContain('boom');
  });
});

