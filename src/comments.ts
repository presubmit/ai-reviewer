import { Octokit } from '@octokit/action';
import { COMMENT_SIGNATURE } from './messages';

export type ReviewComment = {
  path: string;
  body: string;
  diff_hunk?: string;
  line?: number | null;
  in_reply_to_id?: number;
  id: number;
  start_line?: number | null;
  user: {
    login: string;
  };
};

export type ReviewCommentThread = {
  file: string;
  comments: ReviewComment[];
};

export async function listPullRequestCommentThreads(
  octokit: Octokit,
  { owner, repo, pull_number }: { owner: string; repo: string; pull_number: number },
): Promise<ReviewCommentThread[]> {
  let { data: comments } = await octokit.rest.pulls.listReviewComments({
    owner,
    repo,
    pull_number,
  });

  comments = comments.map((c) => ({
    ...c,
    user: {
      ...c.user,
      login: isOwnComment(c.body) ? 'aireview' : c.user.login,
    },
  }));

  return generateCommentThreads(comments);
}

export async function getCommentThread(
  octokit: Octokit,
  {
    owner,
    repo,
    pull_number,
    comment_id,
  }: { owner: string; repo: string; pull_number: number; comment_id: number },
): Promise<ReviewCommentThread | null> {
  const threads = await listPullRequestCommentThreads(octokit, {
    owner,
    repo,
    pull_number,
  });
  return threads.find((t) => t.comments.some((c) => c.id === comment_id)) || null;
}

export function isThreadRelevant(thread: ReviewCommentThread): boolean {
  return thread.comments.some(
    (c) => c.body.includes(COMMENT_SIGNATURE) || c.body.includes('/aireview'),
  );
}

function generateCommentThreads(reviewComments: ReviewComment[]): ReviewCommentThread[] {
  const topLevelComments = reviewComments.filter((c) => !c.in_reply_to_id && c.body.length);

  return topLevelComments.map((topLevelComment) => {
    return {
      file: topLevelComment.path,
      comments: [
        topLevelComment,
        ...reviewComments.filter((c) => c.in_reply_to_id === topLevelComment.id),
      ],
    };
  });
}

export function isOwnComment(comment: string): boolean {
  return comment.includes(COMMENT_SIGNATURE);
}

export function buildComment(comment: string): string {
  return comment + '\n\n' + COMMENT_SIGNATURE;
}
