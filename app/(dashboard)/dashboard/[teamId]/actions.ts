"use server";

import { setSession, getSession } from "@/lib/auth/session";
import prisma from "@/lib/db/prisma";
import { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function selectTeam(teamId: string) {
  const session = await getSession();

  if (!session || !session.userId) {
    throw new Error("Unauthorized");
  }

  // Verify that the user is a member of the selected team
  const teamMember = await prisma.teamMember.findFirst({
    where: {
      userId: session.userId,
      teamId: teamId,
    },
  });

  if (!teamMember) {
    throw new Error("Unauthorized");
  }

  // Update the session with the new team ID
  await setSession({
    ...session,
    teamId: teamId,
    userRole: teamMember.role,
  });

  console.log("Setting session:", teamId);

  redirect(`/dashboard/${teamId}`);
}
