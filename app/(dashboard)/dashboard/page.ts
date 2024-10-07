"use server";

import { getSession, setSession } from "@/lib/auth/session";
import prisma from "@/lib/db/prisma";
import { redirect } from "next/navigation";

export default async function DashboardDefaultPage() {
  const session = await getSession();
  if (!session || !session.userId) {
    throw new Error("Unauthorized");
  }

  // Verify that the user is a member of the selected team
  const teamMember = await prisma.teamMember.findFirst({
    where: {
      userId: session.userId,
    },
  });
  if (!teamMember) {
    throw new Error("Unauthorized");
  }

  const { teamId } = teamMember;

  redirect(`/dashboard/${teamId}`);
}
