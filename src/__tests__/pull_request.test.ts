import { handlePullRequest } from '../pull_request';
import { loadContext } from '../context';
import { initOctokit } from '../octokit';
import { runSummaryPrompt, runReviewPrompt } from '../prompts';
import config from '../config';

// Mock dependencies
jest.mock('../context');
jest.mock('../octokit');
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
    loadInputs: jest.fn()
  }
}));
jest.mock('@actions/core', () => ({
  info: jest.fn(),
  warning: jest.fn()
}));

describe('Pull Request Handler', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    
    // Mock context
    (loadContext as jest.Mock).mockResolvedValue({
      eventName: 'pull_request',
      repo: { owner: 'test-owner', repo: 'test-repo' },
      payload: {
        pull_request: {
          number: 123,
          title: 'Test PR',
          body: 'Test description',
          head: { sha: 'head-sha' },
          base: { sha: 'base-sha' }
        }
      }
    });
    
    // Mock octokit
    const mockOctokit = {
      rest: {
        pulls: {
          listCommits: jest.fn().mockResolvedValue({
            data: [{ sha: 'commit-sha', commit: { message: 'Test commit' } }]
          }),
          listFiles: jest.fn().mockResolvedValue({
            data: [{ filename: 'test.ts', status: 'modified', patch: '@@ -1,1 +1,2 @@\n test\n+added' }]
          }),
          createReview: jest.fn().mockResolvedValue({
            data: { id: 'review-id' }
          }),
          submitReview: jest.fn().mockResolvedValue({})
        },
        issues: {
          listComments: jest.fn().mockResolvedValue({ data: [] }),
          createComment: jest.fn().mockResolvedValue({ data: { id: 'comment-id' } }),
          updateComment: jest.fn().mockResolvedValue({})
        }
      }
    };
    (initOctokit as jest.Mock).mockReturnValue(mockOctokit);
    
    // Mock prompts
    (runSummaryPrompt as jest.Mock).mockResolvedValue({
      title: 'Generated Title',
      description: 'Generated Description',
      files: [{ filename: 'test.ts', summary: 'Test summary', title: 'Test title' }],
      type: ['ENHANCEMENT']
    });
    
    (runReviewPrompt as jest.Mock).mockResolvedValue({
      review: {
        estimated_effort_to_review: 2,
        score: 85,
        has_relevant_tests: true,
        security_concerns: 'No'
      },
      comments: []
    });
  });
  
  test('handles pull request event correctly', async () => {
    await handlePullRequest();
    
    // Verify context was loaded
    expect(loadContext).toHaveBeenCalled();
    
    // Verify octokit was initialized
    expect(initOctokit).toHaveBeenCalled();
    
    // Verify commits and files were fetched
    const mockOctokit = (initOctokit as jest.Mock).mock.results[0].value;
    expect(mockOctokit.rest.pulls.listCommits).toHaveBeenCalledWith({
      owner: 'test-owner',
      repo: 'test-repo',
      pull_number: 123
    });
    
    expect(mockOctokit.rest.pulls.listFiles).toHaveBeenCalledWith({
      owner: 'test-owner',
      repo: 'test-repo',
      pull_number: 123
    });
    
    // Verify summary was generated
    expect(runSummaryPrompt).toHaveBeenCalled();
    
    // Verify comment was created
    expect(mockOctokit.rest.issues.createComment).toHaveBeenCalled();
    
    // Verify review was generated
    expect(runReviewPrompt).toHaveBeenCalled();
  });
  
  test('ignores pull request with skip marker', async () => {
    // Update mock to include skip marker
    (loadContext as jest.Mock).mockResolvedValue({
      eventName: 'pull_request',
      repo: { owner: 'test-owner', repo: 'test-repo' },
      payload: {
        pull_request: {
          number: 123,
          title: 'Test PR',
          body: 'Test description @presubmit skip',
          head: { sha: 'head-sha' },
          base: { sha: 'base-sha' }
        }
      }
    });
    
    await handlePullRequest();
    
    // Verify context was loaded
    expect(loadContext).toHaveBeenCalled();
    
    // Verify octokit was initialized
    expect(initOctokit).toHaveBeenCalled();
    
    // Verify no further processing happened
    const mockOctokit = (initOctokit as jest.Mock).mock.results[0].value;
    expect(mockOctokit.rest.pulls.listCommits).not.toHaveBeenCalled();
    expect(runSummaryPrompt).not.toHaveBeenCalled();
  });
}); 
