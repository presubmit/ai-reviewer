import { runPrompt } from './ai';
import { z } from 'zod';
import { formatFileDiff, File, FileDiff, generateFileCodeDiff } from './diff';
import { ReviewCommentThread } from './comments';
import config from './config';

type PullRequestSummaryPrompt = {
  prTitle: string;
  prDescription: string;
  commitMessages: string[];
  files: File[];
};

export type PullRequestSummary = {
  title: string;
  description: string;
  files: {
    filename: string;
    summary: string;
    title: string;
  }[];
  type: string[];
};

export async function runSummaryPrompt(pr: PullRequestSummaryPrompt): Promise<PullRequestSummary> {
  let systemPrompt = `You are a helpful assistant that summarizes Git Pull Requests (PRs).`;

  systemPrompt += `Your task is to provide a full description for the PR content - title, type, description and affected file summaries.\n`;

  systemPrompt += `
- Keep in mind that the 'Original title', 'Original description' and 'Commit messages' sections may be partial, simplistic, non-informative or out of date. Hence, compare them to the PR diff code, and use them only as a reference.
- The generated title and description should prioritize the most significant changes.
- When quoting variables or names from the code, use backticks (\`).
- Return a summary for each single affected file or if there is nothing to summarize simply use the status of the change (ie. "New file").
- Start the overview with a verb at past tense like "Started", "Commented", "Generated" etc...

IMPORTANT: Do not make assumptions about the code outside the diff. Do not assume variable could be optional if you don't see the type declaration. Do not suggest null checks unless you are sure this could lead to a runtime error.
\n`;

  let userPrompt = `
Summarize the following PR:

<Original PR Title>${pr.prTitle}</Original PR Title>
<Original PR Description>
${pr.prDescription}
</Original PR Description>
<Commit Messages>
${pr.commitMessages.join('\n')}
</Commit Messages>

<Affected Files>
${pr.files.map((file) => `- ${file.status}: ${file.filename}`).join('\n')}
</Affected Files>

<File Diffs>
${pr.files.map((file) => formatFileDiff(file)).join('\n\n')}
</File Diffs>

Make sure each affected file is summarized and it's part of the returned JSON.
`;

  const fileSchema = z.object({
    filename: z.string().describe('The full file path of the relevant file'),
    summary: z
      .string()
      .describe('Concise summary of the file changes in markdown format (max 70 words)'),
    title: z
      .string()
      .describe(
        'An informative title for the changes in this file, describing its main theme (5-10 words).',
      ),
  });

  const schema = z.object({
    title: z
      .string()
      .describe('Informative title of the PR, describing its main theme (10 words max)'),
    description: z
      .string()
      .describe('Informative description of the PR, describing its main theme'),
    files: z
      .array(fileSchema)
      .describe('List of files affected in the PR and summaries of their changes'),
    type: z
      .array(z.string())
      .describe(
        "One or more types that describe this PR's main theme. Example: BUG, TESTS, ENHANCEMENT, DOCUMENTATION, SECURITY, OTHER",
      ),
  });

  return (await runPrompt({
    prompt: userPrompt,
    systemPrompt,
    schema,
  })) as PullRequestSummary;
}

export type AIComment = {
  file: string;
  start_line: number;
  end_line: number;
  highlighted_code: string;
  header: string;
  content: string;
  label: string;
  critical: boolean;
};

export type PullRequestReview = {
  review: {
    estimated_effort_to_review: number;
    score: number;
    has_relevant_tests: boolean;
    security_concerns: string;
  };
  comments: AIComment[];
};

type PullRequestReviewPrompt = {
  prTitle: string;
  prDescription: string;
  prSummary: string;
  files: FileDiff[];
};

export async function runReviewPrompt(pr: PullRequestReviewPrompt): Promise<PullRequestReview> {
  let systemPrompt = `
<IMPORTANT INSTRUCTIONS>
You are an experienced senior software engineer tasked with reviewing a Git Pull Request (PR). Your goal is to provide comments to improve code quality, catch typos, potential bugs or security issues, and provide meaningful code suggestions when applicable. You should not make comments about adding comments, about code formatting, about code style or give implementation suggestions.
    
The review should focus on new code added in the PR code diff (lines starting with '+') and be actionable.
 
The PR diff will have the following structure:
======
## File: 'src/file1.py'

@@ ... @@ def func1():
__new hunk__
11  unchanged code line0 in the PR
12  unchanged code line1 in the PR
13 +new code line2 added in the PR
14  unchanged code line3 in the PR
__old hunk__
 unchanged code line0
 unchanged code line1
-old code line2 removed in the PR
 unchanged code line3
 __existing_comment_thread__
 presubmitai: This is a comment on the code
 user2: This is a reply to the comment above
 __existing_comment_thread__
 presubmitai: This is a comment on some other parts of the code
 user2: This is a reply to the above comment


@@ ... @@ def func2():
__new hunk__
 unchanged code line4
+new code line5 removed in the PR
 unchanged code line6

## File: 'src/file2.py'
...
======

- In the format above, the diff is organized into separate '__new hunk__' and '__old hunk__' sections for each code chunk. '__new hunk__' contains the updated code, while '__old hunk__' shows the removed code. If no code was removed in a specific chunk, the __old hunk__ section will be omitted.
- We also added line numbers for the '__new hunk__' code, to help you refer to the code lines in your suggestions. These line numbers are not part of the actual code, and should only used for reference.
- Code lines are prefixed with symbols ('+', '-', ' '). The '+' symbol indicates new code added in the PR, the '-' symbol indicates code removed in the PR, and the ' ' symbol indicates unchanged code. The review should address new code added in the PR code diff (lines starting with '+')
- Use markdown formatting for your comments.
- Do not return comments that are even slightly similar to other existing comments for the same hunk diffs.
- If you cannot find any actionable comments, return an empty array.
- VERY IMPORTANT: Keep in mind you're only seeing part of the code, and the code might be incomplete. Do not make assumptions about the code outside the diff.

${
  config.styleGuideRules && config.styleGuideRules.length > 0
    ? `Guidelines for the review, such as style guides, conventions, or best practices, violating the following guidelines should result in a critical comment:
${config.styleGuideRules}`
    : ''
}
</IMPORTANT INSTRUCTIONS>

<EXAMPLE>
{
    "review": {
    ...
    }
    "comments": [
    {
        content: "There's a typo in "upgorading" which should be "upgrading".",
        header: "Fix typo in error message.",
        label: "typo",
        critical: false,
        highlighted_code: "      No active plan. Enable code reviews by upgorading to a Pro plan",
        ...
    },
    {
        content: "Variable 'user_id' is used before it's defined. Consider moving the function call to the end of the file.",
        header: "Potential runtime error in the code.",
        label: "bug",
        critical: true,
        ...
    },
    ...
    ]
}
</EXAMPLE>
`;

  let userPrompt = `
<PR title>
${pr.prTitle}
</PR title>

<PR Description>
${pr.prDescription}
</PR Description>

<PR Summary>
${pr.prSummary}
</PR Summary>

<PR File Diffs>
${pr.files.map((file) => generateFileCodeDiff(file)).join('\n\n')}
</PR File Diffs>
`;

  const commentSchema = z.object({
    file: z.string().describe('The full file path of the relevant file'),
    start_line: z
      .number()
      .describe(
        "The relevant line number, from a '__new hunk__' section, where the comment starts (inclusive). Should correspond to the prefix of the first line in the 'highlighted_code' snippet. If comment spans a single line, it should equal the 'end_line'",
      ),
    end_line: z
      .number()
      .describe(
        "The relevant line number, from a '__new hunk__' section, where the comment ends (inclusive). Should correspond to the prefix of the last line in the 'highlighted_code' snippet. If comment spans a single line, it should equal the 'start_line'",
      ),
    content: z
      .string()
      .describe(
        'An actionable comment to enhance, improve or fix the new code introduced in the PR. Use markdown formatting.',
      ),
    header: z
      .string()
      .describe(
        "A concise, single-sentence overview of the comment. Focus on the 'what'. Be general, and avoid method or variable names.",
      ),
    highlighted_code: z
      .string()
      .describe(
        "A short code snippet from a '__new hunk__' section that the comment is applicable for.Include only complete code lines, without line numbers. This snippet should represent the full specific PR code targeted for comment, at its first line should match 'startLine' and last line match 'endLine'. If the code snippet is a single line, that line should match both 'startLine' and 'endLine'",
      ),
    label: z
      .string()
      .describe(
        "A single, descriptive label that best characterizes the suggestion type. Possible labels include 'security', 'possible bug', 'possible issue', 'performance', 'enhancement', 'best practice', 'maintainability', 'readability'. Other relevant labels are also acceptable.",
      ),
    critical: z
      .boolean()
      .describe(
        'True if the comment is critical and the PR should not be merged without addressing the comment. False otherwise.',
      ),
  });

  const reviewSchema = z.object({
    estimated_effort_to_review: z
      .number()
      .min(1)
      .max(5)
      .describe(
        'Estimate, on a scale of 1-5 (inclusive), the time and effort required to review this PR by an experienced and knowledgeable developer. 1 means short and easy review , 5 means long and hard review. Take into account the size, complexity, quality, and the needed changes of the PR code diff.',
      ),
    score: z
      .number()
      .min(0)
      .max(100)
      .describe(
        'Rate this PR on a scale of 0-100 (inclusive), where 0 means the worst possible PR code, and 100 means PR code of the highest quality, without any bugs or performance issues, that is ready to be merged immediately and run in production at scale.',
      ),
    has_relevant_tests: z
      .boolean()
      .describe('True if the PR includes relevant tests added or updated. False otherwise.'),
    security_concerns: z
      .string()
      .describe(
        "Does this PR code introduce possible vulnerabilities such as exposure of sensitive information (e.g., API keys, secrets, passwords), or security concerns like SQL injection, XSS, CSRF, and others ? Answer 'No' (without explaining why) if there are no possible issues. If there are security concerns or issues, start your answer with a short header, such as: 'Sensitive information exposure: ...', 'SQL injection: ...' etc. Explain your answer. Be specific and give examples if possible",
      ),
  });

  let schema = z.object({
    review: reviewSchema.describe('The full review of the PR'),
    comments: z
      .array(commentSchema)
      .describe(
        'Comments about possible bugs, security concerns, code quality, typos or regressions introduced in this PR.',
      ),
  });

  return (await runPrompt({
    prompt: userPrompt,
    systemPrompt,
    schema,
  })) as PullRequestReview;
}

type ReviewCommentPrompt = {
  commentThread: ReviewCommentThread;
  commentFileDiff: FileDiff;
};

export type ReviewCommentResponse = {
  response_comment: string;
  action_requested: boolean;
};

export async function runReviewCommentPrompt({
  commentThread,
  commentFileDiff,
}: ReviewCommentPrompt): Promise<ReviewCommentResponse> {
  let systemPrompt = `You are a helpful senior software engineer that reviews comments on Git Pull Requests (PRs). Your task is to provide a response to a comment on a PR review. The comment might be part of a longer comment thread, so make sure to respond to the specific comment and not the whole thread.

The comment thread is specific to a line or multiple lines of code in a specific file. Keep that in mind when writing your response, but do not assume the code is complete or correct. Also, the comment might request you to suggest some changes or improvements outside the code snippet, so judge accordingly.

In your response, return the exact text of your comment, in markdown, starting by mentioning the @user who made the comment. Your response will be used as a comment on the PR, so make sure it's easy to understand and actionable.

Comments that contain <!-- aireview: comment --> are yours.
Comments prefixed with '/aireview' are instructions or questions addressed specifically to you.

IMPORTANT: Do not respond with generic comments like "Thanks for the PR!" or "LGTM" or "Let me know if you need any help". If the input comment is not actionable, return an empty string. Do not offer to help unless asked.
`;

  const startLine = commentThread.comments[0].start_line || commentThread.comments[0].line;
  const endLine = commentThread.comments[0].line;

  let userPrompt = `
Below you'll see the full comment thread, but you should focus specifically on the last comment.
<Comment Thread>
${commentThread.comments
  .map((comment) => `<author>@${comment.user.login}</author>\n<comment>${comment.body}</comment>`)
  .join('\n')}
</Comment Thread>

<Comment Scope>
  <Lines>${startLine} - ${endLine}</Lines>
  <Hunk>
    ${commentThread.comments[0].diff_hunk}
  </Hunk>
</Comment Scope>

<Comment File Diff>
${generateFileCodeDiff(commentFileDiff)}
</Comment File Diff>
`;

  const schema = z.object({
    response_comment: z
      .string()
      .describe('Your response to the comment in markdown format, starting by mentioning the user'),
    action_requested: z
      .boolean()
      .describe('True if the input comment required an action from you. False otherwise.'),
  });

  return (await runPrompt({
    prompt: userPrompt,
    systemPrompt,
    schema,
  })) as ReviewCommentResponse;
}
