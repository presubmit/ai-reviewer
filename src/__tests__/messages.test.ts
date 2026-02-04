import {
  buildLoadingMessage,
  buildOverviewMessage,
  buildReviewSummary,
  OVERVIEW_MESSAGE_SIGNATURE,
  PAYLOAD_TAG_OPEN,
  PAYLOAD_TAG_CLOSE,
} from '../messages';
import { FileDiff } from '../diff';
import { Context } from '@actions/github/lib/context';
import { AIComment, PullRequestSummary } from '../prompts';
import config from '../config';

// Mock the GitHub context
jest.mock('@actions/github', () => ({
  context: {
    repo: {
      owner: 'test-owner',
      repo: 'test-repo',
    },
  },
}));

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

describe('Messages', () => {
  const mockContext = {
    repo: { owner: 'test-owner', repo: 'test-repo' },
  } as Context;

  const mockFileDiffs: FileDiff[] = [
    {
      filename: 'src/test1.ts',
      status: 'modified',
      hunks: [{ startLine: 1, endLine: 5, diff: '@@ -1,3 +1,5 @@\n test\n+added\n+more' }],
    },
    {
      filename: 'src/test2.ts',
      status: 'added',
      hunks: [{ startLine: 1, endLine: 3, diff: '@@ -0,0 +1,3 @@\n+new file\n+content\n+here' }],
    },
  ];

  const mockCommits = [
    { sha: 'abc123', commit: { message: 'First commit' } },
    { sha: 'def456', commit: { message: 'Second commit' } },
  ];

  test('buildLoadingMessage formats correctly', () => {
    const message = buildLoadingMessage('base-sha', mockCommits, mockFileDiffs);

    expect(message).toContain('Analyzing changes in this PR');
    expect(message).toContain('base-sh');
    expect(message).toContain('abc123');
    expect(message).toContain('def456');
    expect(message).toContain('First commit');
    expect(message).toContain('Second commit');
    expect(message).toContain('src/test1.ts');
    expect(message).toContain('src/test2.ts');
    expect(message).toContain(OVERVIEW_MESSAGE_SIGNATURE);
    expect(message).toContain('https://github.com/test-owner/test-repo/commit/');
  });

  test('buildOverviewMessage formats correctly', () => {
    const mockSummary: PullRequestSummary = {
      title: 'Test PR',
      description: 'This is a test PR',
      files: [
        { filename: 'src/test1.ts', summary: 'Modified test file', title: 'Test 1' },
        { filename: 'src/test2.ts', summary: 'Added new file', title: 'Test 2' },
      ],
      type: ['ENHANCEMENT'],
    };

    const message = buildOverviewMessage(mockSummary, ['commit1', 'commit2']);

    expect(message).toContain('PR Summary');
    expect(message).toContain('This is a test PR');
    expect(message).toContain('src/test1.ts');
    expect(message).toContain('Modified test file');
    expect(message).toContain('src/test2.ts');
    expect(message).toContain('Added new file');
    expect(message).toContain(OVERVIEW_MESSAGE_SIGNATURE);
    expect(message).toContain(PAYLOAD_TAG_OPEN);
    expect(message).toContain(PAYLOAD_TAG_CLOSE);
    expect(message).toContain('"commits":["commit1","commit2"]');
  });

  test('buildReviewSummary formats correctly with comments', () => {
    const mockActionableComments: AIComment[] = [
      {
        file: 'src/test1.ts',
        start_line: 2,
        end_line: 3,
        highlighted_code: '+added',
        header: 'Potential issue',
        content: 'This might cause a problem',
        label: 'possible bug',
        critical: true,
      },
    ];

    const mockSkippedComments: AIComment[] = [
      {
        file: 'src/test2.ts',
        start_line: 1,
        end_line: 1,
        highlighted_code: '+new file',
        header: 'Style suggestion',
        content: 'Consider using a different style',
        label: 'style',
        critical: false,
      },
    ];

    const summary = buildReviewSummary(
      mockContext,
      mockFileDiffs,
      mockCommits,
      mockActionableComments,
      mockSkippedComments,
    );

    expect(summary).toContain('Pull request needs attention');
    expect(summary).toContain('Review Summary');
    expect(summary).toContain('Commits Considered (2)');
    expect(summary).toContain('Files Processed (2)');
    expect(summary).toContain('Actionable Comments (1)');
    expect(summary).toContain('Skipped Comments (1)');
    expect(summary).toContain('src/test1.ts [2-3]');
    expect(summary).toContain('possible bug: "Potential issue"');
    expect(summary).toContain('src/test2.ts [1-1]');
    expect(summary).toContain('style: "Style suggestion"');
    expect(summary).toContain('https://github.com/test-owner/test-repo/commit/');
  });

  test('buildReviewSummary formats correctly with no comments', () => {
    const summary = buildReviewSummary(mockContext, mockFileDiffs, mockCommits, [], []);

    expect(summary).toContain('LGTM!');
    expect(summary).toContain('Actionable Comments (0)');
    expect(summary).toContain('Skipped Comments (0)');
    expect(summary).toContain('https://github.com/test-owner/test-repo/commit/');
  });

  test('buildLoadingMessage uses custom GitHub server URL', () => {
    // Temporarily override the githubServerUrl
    const originalServerUrl = config.githubServerUrl;
    Object.defineProperty(config, 'githubServerUrl', {
      value: 'https://github.example.com',
      writable: true,
    });

    const message = buildLoadingMessage('base-sha', mockCommits, mockFileDiffs);

    expect(message).toContain('https://github.example.com/test-owner/test-repo/commit/');

    // Restore the original value
    Object.defineProperty(config, 'githubServerUrl', {
      value: originalServerUrl,
      writable: true,
    });
  });
});
