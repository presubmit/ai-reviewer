import { jest } from '@jest/globals';

describe('context.loadContext', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    delete process.env.DEBUG;
    delete process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_API_URL;
    delete process.env.GITHUB_REPOSITORY;
    delete process.env.GITHUB_PULL_REQUEST;
    delete process.env.GITHUB_EVENT_NAME;
    delete process.env.GITHUB_EVENT_ACTION;
    delete process.env.GITHUB_COMMENT_ID;
  });

  test('returns @actions/github context when not in DEBUG', async () => {
    const mockContext = { eventName: 'pull_request', repo: { owner: 'o', repo: 'r' }, payload: {} } as any;
    jest.doMock('@actions/github', () => ({ __esModule: true, context: mockContext, getOctokit: jest.fn() }));

    const { loadContext } = await import('../context');
    const ctx = await loadContext();
    expect(ctx).toBe(mockContext);
  });

  test('throws when DEBUG and no GITHUB_TOKEN', async () => {
    process.env.DEBUG = '1';
    jest.doMock('@actions/github', () => ({ __esModule: true, context: {}, getOctokit: jest.fn() }));
    const { loadContext } = await import('../context');
    await expect(loadContext()).rejects.toThrow('GITHUB_TOKEN is not set');
  });

  test('builds debug context with PR and optional comment', async () => {
    process.env.DEBUG = '1';
    process.env.GITHUB_TOKEN = 't';
    process.env.GITHUB_REPOSITORY = 'o/r';
    process.env.GITHUB_PULL_REQUEST = '42';
    process.env.GITHUB_EVENT_NAME = 'pull_request';
    process.env.GITHUB_EVENT_ACTION = 'opened';
    process.env.GITHUB_API_URL = 'https://api.github.example';
    process.env.GITHUB_COMMENT_ID = '1001';

    const get = jest.fn().mockResolvedValue({ data: { number: 42, html_url: 'u', body: 'b' } });
    const getReviewComment = jest.fn().mockResolvedValue({ data: { id: 1001, body: 'comment' } });

    const getOctokit = jest.fn().mockReturnValue({ rest: { pulls: { get }, getReviewComment: undefined, }, });
    // shape in code is octokit.rest.pulls.get and octokit.rest.pulls.getReviewComment — adjust mock hierarchy
    (getOctokit as any).mockReturnValue({ rest: { pulls: { get, getReviewComment }, } });

    jest.doMock('@actions/github', () => ({ __esModule: true, context: { issue: { number: 1 } }, getOctokit }));

    const { loadContext } = await import('../context');
    const ctx = await loadContext();

    expect(getOctokit).toHaveBeenCalledWith('t', { baseUrl: 'https://api.github.example' });
    expect(ctx.eventName).toBe('pull_request');
    expect(ctx.repo).toEqual({ owner: 'o', repo: 'r' });
    expect(ctx.payload.pull_request.number).toBe(42);
    expect(ctx.payload.comment).toEqual({ id: 1001, body: 'comment' });
  });
});

