import { generateObject, generateText } from "ai";
import { z } from "zod";
import { anthropic } from "@ai-sdk/anthropic";

type PullRequestSummary = {
  files: {
    file_name: string;
    summary: string;
    comments: {
      type: "FILE" | "LINE";
      line: number;
      highlight_start: number;
      highlight_length: number;
      text: string;
    }[];
  }[];
  status: "APPROVED" | "IN_REVIEW";
};

export async function summarizePullRequestDiff(
  diff: string
): Promise<PullRequestSummary> {
  const systemPrompt = `You are an AI assistant tasked with summarizing GitHub pull request diffs. Please provide a concise summary of the following diff, highlighting the main changes and their potential impact.
    
    Review the changes and respond in the following format:
    {
        files: array[
            object{
                file_name: string,
                summary: string,
                comments: array[
                    object{
                        type: "FILE" | "LINE",
                        line: number,
                        highlight_start: number,
                        highlight_length: number,
                        text: string,
                    }
                ]
            }
        ]
        status: "APPROVED" | "IN_REVIEW",
    } 
    
    For comments, only add them if the change is not following best practices or has potential security issues such as not using parameterized queries or not sanitizing user inputs or exposing sensitive information. Do not give general suggestions, but only specific to the code changed. If changes look good, do not return any comments.

    For file summaries, keep them brief and to the point under 100 words, focusing on the key changes and their impact.`;

  const prompt = `
  Below is the diff of a GitHub pull request. Do not interpret the diff, just summarize it.

  <START_DIFF>
  ${diff}
  <END_DIFF>`;

  const { object } = await generateObject({
    model: anthropic("claude-3-5-sonnet-20240620"),
    system: systemPrompt,
    schema: z.object({
      files: z.array(
        z.object({
          file_name: z.string(),
          summary: z.string(),
          comments: z.array(
            z.object({
              type: z.enum(["FILE", "LINE"]),
              line: z.number(),
              highlight_start: z.number(),
              highlight_length: z.number(),
              text: z.string(),
            })
          ),
        })
      ),
      status: z.enum(["APPROVED", "IN_REVIEW"]),
    }),
    prompt,
  });

  console.log("Response: ", object);

  return object as PullRequestSummary;
}
