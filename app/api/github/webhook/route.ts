import { NextResponse } from "next/server";
import { getInstallationOctokit } from "../utils";
import { Octokit } from "@octokit/rest";
import { summarizePullRequestDiff } from "@/lib/ai";
import prisma from "@/lib/db/prisma";

export async function POST(req: Request) {
  const payload = await req.json();
  console.log("Payload", payload);
  const githubEvent = req.headers.get("x-github-event");
  console.log("Github event", githubEvent);

  if (githubEvent === "installation") {
    const installation = payload.installation;
    await handleInstallation(payload.action, installation);
  }

  // Handle new pull request
  // TODO: Maybe handle edited as well?
  if (githubEvent === "pull_request" && payload.action === "opened") {
    await handleNewPullRequest(payload);
  }

  if (
    githubEvent === "issue_comment" &&
    payload.action === "created" &&
    payload.issue.pull_request
  ) {
    await handlePullRequestComment(payload);
  }

  return NextResponse.json({ message: "Event received" }, { status: 200 });
}

async function handleInstallation(action: string, installation: any) {
  const { account } = installation;
  console.log("Action", action);
  console.log("Installation", installation);

  const intallationId = action === "deleted" ? null : String(installation.id);
  const githubId = String(account.id);

  // Find team associated with the github account.
  const team = await prisma.team.findFirst({
    where: {
      githubId,
    },
  });
  if (!team) {
    return;
  }

  // Maybe update the installation id.
  if (team.githubInstallationId != intallationId) {
    console.log("Updating installation id: ", intallationId);
    await prisma.team.update({
      where: {
        id: team.id,
      },
      data: {
        githubInstallationId: intallationId,
      },
    });
  }
}

async function handlePullRequestComment(payload: any) {
  const commentBody = payload.comment.body.toLowerCase();
  if (!commentBody.startsWith("@aipresubmit ")) {
    return;
  }

  const command = commentBody.split(" ")[1]?.trim().toLowerCase();
  console.log("@aipresubmit command: ", command);

  const { installation, repository, issue } = payload;

  if (command === "summary") {
    await summarizePullRequest(installation.id, repository, issue.number);
    return;
  }
  if (command === "resolve") {
    // await resolvePullRequestComments(payload);
    return;
  }
}

async function handleNewPullRequest(payload: any) {
  const { installation, repository, pull_request } = payload;
  try {
    await summarizePullRequest(
      installation.id,
      repository,
      pull_request.number
    );

    // TODO: Record the PR owner as a user of the team.
  } catch (error) {
    console.error("Error handling new PR:", error);
  }
}

async function summarizePullRequest(
  installationId: number,
  repository: any,
  prNumber: number
) {
  const octokit = await getInstallationOctokit(installationId);

  // Fetch the pull request diff
  const diff = await getPullRequestDiff(octokit, repository, prNumber);
  console.log("Diff: ", diff);

  // Summarize the contents of the pull request using the diff.
  const summary = await summarizePullRequestDiff(diff);

  const buildSummaryTable = (files: any[]) => {
    let table = "| FILE | SUMMARY |\n|------|---------|";
    files.forEach((file) => {
      table += `\n| ${file.file_name} | ${file.summary.replace(/\n/g, " ")} |`;
    });
    return table;
  };

  const text = `
## AI Summary

Status: ${summary.status}

${buildSummaryTable(summary.files)}

### Detailed Comments:
${summary.files
  .map(
    (file: any) =>
      `\n#### ${file.file_name}\n${file.comments
        .map(
          (comment: any) => `- ${comment.type} ${comment.line}: ${comment.text}`
        )
        .join("\n")}`
  )
  .join("\n")}
  `;

  console.log("Summary: ", text);

  // Add a comment to the pull request
  await addCommentToPullRequest(octokit, repository, prNumber, text);
}

async function addCommentToPullRequest(
  octokit: Octokit,
  repository: any,
  prNumber: number,
  comment: string
): Promise<void> {
  try {
    const response = await octokit.issues.createComment({
      owner: repository.owner.login,
      repo: repository.name,
      issue_number: prNumber,
      body: comment,
    });
    console.log(`Added PR comment: ${response.data.html_url}`);
  } catch (error) {
    console.error("Error adding comment to PR:", error);
    throw error;
  }
}

async function getPullRequestDiff(
  octokit: Octokit,
  repository: any,
  prNumber: number
): Promise<string> {
  try {
    const response = await octokit.pulls.get({
      owner: repository.owner.login,
      repo: repository.name,
      pull_number: prNumber,
      mediaType: {
        format: "diff",
      },
    });

    return response.data as unknown as string;
  } catch (error) {
    console.error("Error fetching pull request diff:", error);
    throw error;
  }
}
