import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GithubIcon } from "lucide-react";
import { getTeamAccess } from "@/lib/auth/session";
import { getInstallationOctokit } from "@/app/api/github/utils";
import prisma from "@/lib/db/prisma";
import { notFound } from "next/navigation";
import { TeamParams } from "@/lib/utils";
import Link from "next/link";
import { Section } from "@/components/ui/section";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AvatarIcon, GitHubLogoIcon } from "@radix-ui/react-icons";
import { Switch } from "@/components/ui/switch";

export default async function Repositories({ params }: { params: TeamParams }) {
  const teamAccess = await getTeamAccess(params);
  if (!teamAccess) {
    return notFound();
  }

  const repositories = await getRepositories(params.teamId);

  const connectRepositoryUrl =
    "https://github.com/apps/aipresubmit/installations/new";

  return (
    <Section
      title="Repositories"
      cta={
        <Link href={connectRepositoryUrl}>
          <Button variant="primary">
            <GithubIcon className="mr-2 h-4 w-4" />
            Connect Repository
          </Button>
        </Link>
      }
    >
      {repositories.length === 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Repositories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                <div className="mb-4 sm:mb-0">
                  <p className="font-medium">No repositories connected</p>
                  <p className="text-sm text-muted-foreground">
                    Connect your Github repositories to start reviewing code.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {repositories.map((repository) => (
        <Card key={repository.id} className="mb-4">
          <CardHeader className="flex flex-row items-center space-y-0 justify-between">
            <div className="flex items-center gap-4">
              <GitHubLogoIcon className="h-6 w-6" />
              <Link
                href={`https://github.com/${repository.full_name}`}
                target="_blank"
              >
                <CardTitle className="hover:underline">
                  {repository.full_name}
                </CardTitle>
              </Link>
            </div>
            <Switch className="data-[state=checked]:bg-green-700" />
          </CardHeader>
        </Card>
      ))}
    </Section>
  );
}

async function getRepositories(teamId: string) {
  const team = await prisma.team.findFirst({
    where: {
      id: teamId,
    },
  });
  if (!team?.githubInstallationId) {
    return [];
  }

  const octokit = await getInstallationOctokit(
    Number(team.githubInstallationId)
  );
  const { data } = await octokit.apps.listReposAccessibleToInstallation({
    installation_id: Number(team.githubInstallationId),
  });
  return data.repositories;
}
