import { Octokit } from "@octokit/action";
import { COMMENT_SIGNATURE } from "./messages";
import config from "./config";

export type ReviewComment = {
  path: string;
  body: string;
  diff_hunk?: string;
  line?: number;
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
  {
    owner,
    repo,
    pull_number,
  }: { owner: string; repo: string; pull_number: number }
): Promise<ReviewCommentThread[]> {
  const per_page = 100;
  let page = 1;
  const all: ReviewComment[] = [];
  while (true) {
    const { data } = await octokit.rest.pulls.listReviewComments({
      owner,
      repo,
      pull_number,
      per_page,
      page,
    });

    if (Array.isArray(data)) {
      const mapped: ReviewComment[] = data.map((c: any) => ({
        path: c.path,
        body: c.body ?? "",
        diff_hunk: c.diff_hunk,
        line: typeof c.line === 'number' ? c.line : undefined,
        in_reply_to_id: typeof c.in_reply_to_id === 'number' ? c.in_reply_to_id : undefined,
        id: c.id,
        start_line: typeof c.start_line === 'number' ? c.start_line : null,
        user: {
          login: isOwnComment(c.body ?? "") ? "presubmit" : (c.user?.login ?? ""),
        },
      }));
      all.push(...mapped);
      if (data.length < per_page) break;
      page += 1;
    } else {
      break;
    }
  }

  return generateCommentThreads(all);
}

export async function getCommentThread(
  octokit: Octokit,
  {
    owner,
    repo,
    pull_number,
    comment_id,
  }: { owner: string; repo: string; pull_number: number; comment_id: number }
): Promise<ReviewCommentThread | null> {
  const threads = await listPullRequestCommentThreads(octokit, {
    owner,
    repo,
    pull_number,
  });
  return (
    threads.find((t) => t.comments.some((c) => c.id === comment_id)) || null
  );
}

export function isThreadRelevant(thread: ReviewCommentThread): boolean {
  return thread.comments.some(
    (c) =>
      c.body.includes(COMMENT_SIGNATURE) ||
      c.body.includes("@presubmitai") ||
      c.body.includes("@presubmit")
  );
}

function generateCommentThreads(
  reviewComments: ReviewComment[]
): ReviewCommentThread[] {
  const topLevelComments = reviewComments.filter((c) => {
    const hasTopLevelMarker = !c.in_reply_to_id && c.body.length;
    const hasLineRef = typeof c.line === 'number' || typeof c.start_line === 'number';
    return hasTopLevelMarker && hasLineRef;
  });

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
  const max = (config as { maxCodeblockLines: number }).maxCodeblockLines ?? 60;
  const lines = (comment ?? '').split('\n');
  const out: string[] = [];
  let inBlock = false;
  let emittedTrunc = false;
  let count = 0;

  const isFence = (s: string) => s.trim().startsWith('```');

  for (const line of lines) {
    if (isFence(line)) {
      if (inBlock) {
        // closing fence
        out.push(line);
        inBlock = false;
        emittedTrunc = false;
        count = 0;
      } else {
        // opening fence
        out.push(line);
        inBlock = true;
        emittedTrunc = false;
        count = 0;
      }
      continue;
    }

    if (inBlock) {
      if (count < max) {
        out.push(line);
        count += 1;
      } else {
        if (!emittedTrunc) {
          out.push('... (truncated; more lines omitted) ...');
          emittedTrunc = true;
        }
        // drop extra lines
      }
    } else {
      out.push(line);
    }
  }

  return out.join('\n') + "\n\n" + COMMENT_SIGNATURE;
}
