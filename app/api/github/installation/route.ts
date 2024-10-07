import { NextResponse } from "next/server";
import { getInstallationOctokit } from "@/app/api/github/utils";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const installationId = searchParams.get("installation_id");

  if (!installationId) {
    return NextResponse.redirect(`${process.env.BASE_URL}/dashboard`);
  }

  const octokit = await getInstallationOctokit(Number(installationId));

  const { data: repos } = await octokit.apps.listReposAccessibleToInstallation({
    installation_id: Number(installationId),
  });

  // TODO: maybe save repositories

  return NextResponse.json({ repos }, { status: 200 });
}
