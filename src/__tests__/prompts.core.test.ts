import { jest } from '@jest/globals';

const mockRunPrompt = jest.fn().mockResolvedValue({ any: 'ok' });

describe('prompts.ts core prompts', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockRunPrompt.mockClear();
  });

  test('runSummaryPrompt builds limited diffs and affected files list', async () => {
    jest.doMock('../ai', () => ({ __esModule: true, runPrompt: mockRunPrompt }));
    jest.doMock('../config', () => ({
      __esModule: true,
      default: { maxReviewChars: 50 },
    }));

    const { runSummaryPrompt } = await import('../prompts');

    const files = [
      { filename: 'a.ts', status: 'modified', patch: '@@ -1,1 +1,1 @@\n+1 a\n' },
      { filename: 'b.ts', status: 'added', patch: '@@ -1,1 +1,1 @@\n+2 b\n' },
      { filename: 'c.ts', status: 'removed', patch: '@@ -1,1 +1,1 @@\n+3 c\n' },
    ] as any;

    await runSummaryPrompt({ prTitle: 'T', prDescription: 'D', commitMessages: ['m1', 'm2'], files });

    expect(mockRunPrompt).toHaveBeenCalled();
    const call = mockRunPrompt.mock.calls[0][0];
    // Shows affected files list
    expect(call.prompt).toContain('- modified: a.ts');
    // Contains the diff section
    expect(call.prompt).toContain('File Diffs');
  });

  test('runReviewPrompt embeds diffs and respects styleGuideRules when empty', async () => {
    jest.doMock('../ai', () => ({ __esModule: true, runPrompt: mockRunPrompt }));
    jest.doMock('../config', () => ({ __esModule: true, default: { styleGuideRules: '' } }));

    const { runReviewPrompt } = await import('../prompts');

    const files = [
      { filename: 'src/x.ts', status: 'modified', hunks: [{ startLine: 1, endLine: 1, diff: '@@ -1,1 +1,1 @@\n+const x=1' }] },
    ] as any;

    await runReviewPrompt({ prTitle: 'T', prDescription: 'D', prSummary: 'S', files });
    const call = mockRunPrompt.mock.calls[0][0];
    expect(call.systemPrompt).toContain('<IMPORTANT INSTRUCTIONS>');
    expect(call.prompt).toContain('src/x.ts');
    expect(call.prompt).toContain('__new hunk__');
  });

  test('runReviewCommentPrompt builds thread and diff scope', async () => {
    jest.doMock('../ai', () => ({ __esModule: true, runPrompt: mockRunPrompt }));

    const { runReviewCommentPrompt } = await import('../prompts');

    const commentThread = {
      comments: [
        {
          user: { login: 'user1' },
          body: 'Old comment',
          start_line: 10,
          line: 12,
          diff_hunk: '@@ -1,1 +1,1 @@\n- old\n+ new',
        },
        { user: { login: 'user2' }, body: 'New comment', line: 12 },
      ],
    } as any;
    const commentFileDiff = {
      filename: 'src/y.ts',
      status: 'modified',
      hunks: [{ startLine: 10, endLine: 12, diff: '@@ -10,3 +10,3 @@\n+abc' }],
    } as any;

    await runReviewCommentPrompt({ commentThread, commentFileDiff });

    const call = mockRunPrompt.mock.calls[0][0];
    expect(call.prompt).toContain('@user2');
    expect(call.prompt).toContain('src/y.ts');
    expect(call.prompt).toContain('__new hunk__');
  });
});



  test('runReviewPrompt includes styleGuideRules when provided', async () => {
    mockRunPrompt.mockClear();
    mockRunPrompt.mockResolvedValue({ ok: true } as any);
    jest.doMock('../ai', () => ({ __esModule: true, runPrompt: mockRunPrompt }));
    const { runReviewPrompt } = await import('../prompts');
    const cfg = (await import('../config')).default as any;
    cfg.styleGuideRules = 'RULE-A';

    const files: any = [ { filename: 'src/z.ts', status: 'modified', hunks: [{ startLine:1, endLine:1, diff: '@@ -1,1 +1,1 @@\n+Z' }] } ];
    await runReviewPrompt({ prTitle: 'T', prDescription: 'D', prSummary: 'S', files });
    const call = (mockRunPrompt as any).mock.calls[0][0];
    expect(call.systemPrompt).toContain('Guidelines for the review');
    expect(call.systemPrompt).toContain('RULE-A');
  });
