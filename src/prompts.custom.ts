import { runPrompt } from "./ai";
import { warning } from "@actions/core";
import { z } from "zod";
import { FileDiff, generateFileCodeDiff } from "./diff";
import config from "./config";
import type { PullRequestReview } from "./prompts";

export type PullRequestReviewPrompt = {
  prTitle: string;
  prDescription: string;
  prSummary: string;
  files: FileDiff[];
};

// Reuse the same output shape as standard review
export type { PullRequestReview };

// Focus area definitions keyed by scope name
const FOCUS_AREAS: Record<string, string> = {
  security: `**Security & Safety:**
- Identify potential security vulnerabilities (injection attacks, authentication/authorization issues, data exposure)
- Flag unsafe operations, unvalidated inputs, and improper error handling
- Check for secrets, credentials, or sensitive data in code
- Verify proper input sanitization and output encoding`,

  performance: `**Performance & Scalability:**
- Identify performance bottlenecks, inefficient algorithms, or resource leaks
- Flag N+1 queries, unnecessary loops, or blocking operations
- Check for proper caching strategies and resource management
- Verify efficient data structures and algorithms are used`,

  "best-practices": `**Code Quality & Maintainability:**
- Identify complex logic that could be simplified or refactored
- Flag code duplication, tight coupling, or violation of SOLID principles
- Check for proper error handling and logging
- Verify code follows established patterns and conventions

**Architecture & Design:**
- Identify architectural inconsistencies or anti-patterns
- Flag violations of separation of concerns or single responsibility principle
- Check for proper abstraction levels and interface design
- Verify dependency management and modularity

**Testing & Reliability:**
- Identify missing test coverage for critical paths
- Flag brittle tests or test code that doesn't follow best practices
- Check for proper mocking and test isolation
- Verify edge cases and error conditions are tested

**Documentation & Communication:**
- Flag missing or unclear documentation for complex logic
- Check for proper API documentation and usage examples
- Verify commit messages and PR descriptions are clear and informative`,
};

export async function runReviewPrompt({
  prTitle,
  prDescription,
  prSummary,
  files,
}: PullRequestReviewPrompt): Promise<PullRequestReview> {
  // Build focus areas based on configured scopes (default: all three)
  const scopes = config.reviewScopes || ["security", "performance", "best-practices"];
  const focusAreas = scopes
    .filter((s) => FOCUS_AREAS[s])
    .map((s) => FOCUS_AREAS[s])
    .join("\n\n");

  let systemPrompt = `
<IMPORTANT INSTRUCTIONS>
You are a highly experienced senior software engineer reviewing a GitHub Pull Request (PR). Your expertise spans multiple programming languages, frameworks, and architectural patterns. Provide only high-value, actionable comments that improve code quality, security, performance, maintainability, and adherence to software engineering best practices.

Focus on critical areas that matter most:

${focusAreas}

Only comment on code introduced in this PR (lines starting with '+'). Focus on issues that could cause bugs, security vulnerabilities, performance problems, or maintenance difficulties. Avoid commenting on minor style issues unless they impact functionality.

When suggesting changes, provide minimal, targeted code examples with proper syntax highlighting and keep snippets concise (≤ 15 lines).

<DOCUMENTATION>
In addition to review comments, generate a concise "documentation" field in markdown that the PR author can paste into the PR description or release notes. Structure it as follows:

## Summary
A brief 2-3 sentence overview of what this PR accomplishes and why it matters.

## Changes
- Bullet list of key changes (new features, bug fixes, refactors)
- Group related changes together
- Be specific: mention file names, function names, or components affected

## Release Notes
A single paragraph or bullet suitable for end-user facing release notes. Focus on user-visible impact, not implementation details. If this is purely internal/infrastructure, write "Internal changes only."

## Technical Notes (optional)
Include only if there are important technical details reviewers or future maintainers should know:
- Breaking changes or migration steps
- New dependencies added
- Configuration changes required
- Performance implications

Keep the documentation concise and actionable. Do not include test instructions, deployment steps, or rollback plans.
</DOCUMENTATION>
`;

  systemPrompt += `

${config.styleGuideRules && config.styleGuideRules.length > 0 ? `\nGuidelines to enforce (critical violations should be marked critical):\n${config.styleGuideRules}` : ""}
</IMPORTANT INSTRUCTIONS>`;

  const userPrompt = `
<PR title>
${prTitle}
</PR title>

<PR Description>
${prDescription}
</PR Description>

<PR Summary>
${prSummary}
</PR Summary>

<PR File Diffs>
${files.map((file) => generateFileCodeDiff(file)).join("\n\n")}
</PR File Diffs>
`;

  const commentSchema = z.object({
    file: z.string().describe("The full file path of the relevant file"),
    start_line: z
      .number()
      .describe(
        "Relevant line number (inclusive) from a '__new hunk__' section where comment starts"
      ),
    end_line: z
      .number()
      .describe(
        "Relevant line number (inclusive) from a '__new hunk__' section where comment ends"
      ),
    content: z
      .string()
      .describe(
        "Actionable comment to enhance/fix the new code introduced in the PR. Use markdown. When proposing code, include fenced code blocks with appropriate language syntax highlighting and keep snippets under 15 lines."
      ),
    header: z
      .string()
      .describe(
        "Concise, single-sentence overview of the comment. Focus on the 'what'."
      ),
    highlighted_code: z
      .string()
      .describe(
        "Short code snippet from a '__new hunk__' the comment refers to, without line numbers."
      ),
    label: z
      .string()
      .describe(
        "Single, descriptive label: 'security', 'possible bug', 'bug', 'performance', 'enhancement', 'maintainability', 'architecture', etc."
      ),
    critical: z
      .boolean()
      .describe(
        "True if the PR should not be merged without addressing the comment; false otherwise."
      ),
  });

  const reviewSchema = z.object({
    estimated_effort_to_review: z
      .number()
      .min(1)
      .max(5)
      .describe(
        "Estimated effort (1-5) required to review this PR by an experienced developer."
      ),
    score: z
      .number()
      .min(0)
      .max(100)
      .describe(
        "PR quality score (0-100), where 100 means production-grade with no issues."
      ),
    has_relevant_tests: z
      .boolean()
      .describe(
        "True if PR includes relevant tests added/updated; false otherwise."
      ),
    security_concerns: z
      .string()
      .describe(
        "Summarize any potential security or compliance issues, or 'None identified' if none."
      ),
  });

  const commentsUnion = z.union([
    z.array(commentSchema),
    z.object({ comments: z.array(commentSchema) }),
    z.string(), // Allow JSON string (Qwen models sometimes return this)
  ]);

  const baseResponseSchema = z.object({
    review: reviewSchema.describe("The full review of the PR"),
    documentation: z
      .string()
      .describe(
        "Concise PR documentation in markdown with sections: Summary, Changes (bullet list), Release Notes (user-facing), and optional Technical Notes (breaking changes, new deps, config). No test/deployment/rollback instructions."
      ),
    comments: commentsUnion.describe("Actionable comments on issues introduced by this PR"),
  });

  // Some models (e.g., Claude Sonnet 4.5) wrap the response in a "parameters" object
  // Make both the wrapped and unwrapped versions optional so either format is accepted
  const schema = z.object({
    review: reviewSchema.optional(),
    documentation: z.string().optional(),
    comments: commentsUnion.optional(),
    parameters: baseResponseSchema.optional(),
  });

  const raw: any = await runPrompt({
    prompt: userPrompt,
    systemPrompt,
    schema,
  });

  // Handle models that wrap response in a "parameters" object (e.g., Claude Sonnet 4.5)
  const unwrapped = raw.parameters || raw;

  // Normalize comments field (handle array, object with comments, or JSON string)
  let comments: any[] = [];
  let commentsWarning = false;
  if (Array.isArray(unwrapped.comments)) {
    comments = unwrapped.comments;
  } else if (typeof unwrapped.comments === 'object' && unwrapped.comments?.comments) {
    comments = unwrapped.comments.comments;
  } else if (typeof unwrapped.comments === 'string') {
    try {
      const parsed = JSON.parse(unwrapped.comments);
      comments = Array.isArray(parsed) ? parsed : (parsed?.comments ?? []);
    } catch {
      commentsWarning = true;
      comments = [];
    }
  } else if (unwrapped.comments !== undefined) {
    commentsWarning = true;
  }

  // Warn if LLM returned malformed data and we had to use fallbacks
  const usedReviewFallback = !unwrapped.review;
  if (usedReviewFallback) {
    warning('LLM response missing "review" field; using placeholder values');
  }
  if (commentsWarning) {
    warning('LLM response had malformed "comments" field; defaulting to empty');
  }

  const normalized: PullRequestReview = {
    review: unwrapped.review || {
      estimated_effort_to_review: 3,
      score: 50,
      has_relevant_tests: false,
      security_concerns: 'Unable to determine',
    },
    comments,
    documentation: typeof unwrapped.documentation === 'string' ? unwrapped.documentation : undefined,
  };
  return normalized;
}

