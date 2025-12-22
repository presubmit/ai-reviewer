import { buildComment, isOwnComment, isThreadRelevant, ReviewCommentThread } from '../comments';
import { COMMENT_SIGNATURE } from '../messages';

jest.mock('../config', () => ({
  __esModule: true,
  default: { maxCodeblockLines: 3 },
}));

describe('comments utilities', () => {
  test('buildComment appends signature and truncates code blocks', () => {
    const input = [
      'Intro text',
      '```ts',
      'line 1',
      'line 2',
      'line 3',
      'line 4 should be truncated',
      'line 5 should be truncated',
      '```',
      'Outro text',
    ].join('\n');

    const out = buildComment(input);

    // Has signature
    expect(out).toContain(COMMENT_SIGNATURE);

    // Code block kept only 3 lines + truncation marker
    expect(out).toContain('line 1');
    expect(out).toContain('line 2');
    expect(out).toContain('line 3');
    expect(out).toContain('... (truncated; more lines omitted) ...');
    expect(out).not.toContain('line 4 should be truncated');
    expect(out).not.toContain('line 5 should be truncated');

    // Non-code text preserved
    expect(out).toContain('Intro text');
    expect(out).toContain('Outro text');
  });

  test('isOwnComment detects our signature', () => {
    const out = buildComment('hello');
    expect(isOwnComment(out)).toBe(true);
    expect(isOwnComment('just a comment')).toBe(false);
  });

  test('isThreadRelevant checks signature and mentions', () => {
    const base: ReviewCommentThread = {
      file: 'f.ts',
      comments: [
        { id: 1, body: 'first', user: { login: 'u' }, path: 'f.ts' },
      ] as any,
    };

    expect(isThreadRelevant(base)).toBe(false);

    const withSig: ReviewCommentThread = {
      ...base,
      comments: [{ id: 1, body: 'first' + COMMENT_SIGNATURE, user: { login: 'u' }, path: 'f.ts' }] as any,
    };
    expect(isThreadRelevant(withSig)).toBe(true);

    const withPresubmit: ReviewCommentThread = {
      ...base,
      comments: [{ id: 1, body: 'please @presubmit check', user: { login: 'u' }, path: 'f.ts' }] as any,
    };
    expect(isThreadRelevant(withPresubmit)).toBe(true);

    const withPresubmitAI: ReviewCommentThread = {
      ...base,
      comments: [{ id: 1, body: 'ping @presubmitai', user: { login: 'u' }, path: 'f.ts' }] as any,
    };
    expect(isThreadRelevant(withPresubmitAI)).toBe(true);
  });
});



  test('getCommentThread finds by comment_id via octokit listReviewComments', async () => {
    jest.resetModules();
    const { getCommentThread } = await import('../comments');
    const octokit: any = {
      rest: {
        pulls: {
          listReviewComments: jest.fn().mockResolvedValue({ data: [
            { id: 10, path: 'a.ts', body: 'Top', line: 5, user: { login: 'u' } },
            { id: 11, path: 'a.ts', body: 'Reply', in_reply_to_id: 10, user: { login: 'u' } },
          ] })
        }
      }
    };

    const thread = await getCommentThread(octokit, { owner: 'o', repo: 'r', pull_number: 1, comment_id: 11 });
    expect(thread).not.toBeNull();
    expect(thread!.comments.length).toBe(2);
    expect(thread!.file).toBe('a.ts');
  });



test('listPullRequestCommentThreads paginates across pages', async () => {
  jest.resetModules();
  const { listPullRequestCommentThreads } = await import('../comments');
  const listReviewComments = jest
    .fn()
    .mockResolvedValueOnce({
      data: [
        { id: 1, path: 'a.ts', body: 'Top A', line: 5, user: { login: 'u' } },
        // Fill to per_page boundary to force another page
        ...Array.from({ length: 99 }).map((_, i) => ({ id: 1000 + i, body: 'x', user: { login: 'u' } }))
      ],
    })
    .mockResolvedValueOnce({
      data: [ { id: 2, path: 'b.ts', body: 'Top B', line: 7, user: { login: 'u' } } ],
    });
  const octokit: any = { rest: { pulls: { listReviewComments } } };

  const threads = await listPullRequestCommentThreads(octokit, { owner: 'o', repo: 'r', pull_number: 1 });
  const files = threads.map(t => t.file).sort();
  expect(files).toEqual(['a.ts','b.ts']);
  // ensure we actually paginated
  expect(listReviewComments).toHaveBeenCalledTimes(2);
});



test('multiline top-level (start_line only) forms a thread and collects replies', async () => {
  jest.resetModules();
  const { listPullRequestCommentThreads } = await import('../comments');
  const listReviewComments = jest.fn().mockResolvedValue({
    data: [
      { id: 50, path: 'm.ts', body: 'Top multiline', start_line: 3, user: { login: 'u' } },
      { id: 51, path: 'm.ts', body: 'Reply 1', in_reply_to_id: 50, user: { login: 'u' } },
    ]
  });
  const octokit: any = { rest: { pulls: { listReviewComments } } };
  const threads = await listPullRequestCommentThreads(octokit, { owner: 'o', repo: 'r', pull_number: 2 });
  expect(threads.length).toBe(1);
  expect(threads[0].file).toBe('m.ts');
  expect(threads[0].comments.map(c => c.id)).toEqual([50, 51]);
});
