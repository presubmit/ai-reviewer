import { notFound, redirect } from "next/navigation";
import { Settings } from "./settings";
import { getSession, getTeamAccess } from "@/lib/auth/session";
import prisma from "@/lib/db/prisma";
import { TeamParams } from "@/lib/utils";

export default async function SettingsPage({ params }: { params: TeamParams }) {
  const teamAccess = await getTeamAccess(params);
  if (!teamAccess) {
    return notFound();
  }
  const { teamId } = params;

  const team = await prisma.team.findFirst({
    where: {
      id: teamId,
    },
    include: {
      members: {
        include: {
          user: true,
        },
      },
    },
  });
  if (!team) {
    throw new Error("Team not found");
  }

  return <Settings team={team} />;
}
