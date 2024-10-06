"use server";

import { z } from "zod";
import prisma from "@/lib/db/prisma";
import {
  comparePasswords,
  getSession,
  hashPassword,
  setSession,
} from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createCheckoutSession } from "@/lib/payments/stripe";
import {
  validatedAction,
  validatedActionWithUser,
} from "@/lib/auth/middleware";
import {
  ActivityLog,
  ActivityType,
  InvitationStatus,
  Team,
  UserRole,
} from "@prisma/client";

async function logActivity(type: ActivityType, ipAddress?: string) {
  const session = await getSession();
  if (!session) {
    console.error("No session data.");
    return;
  }
  const { userId, teamId } = session;

  await prisma.activityLog.create({
    data: {
      teamId,
      userId,
      action: type,
      ipAddress: ipAddress || "",
    },
  });
}

const signInSchema = z.object({
  email: z.string().email().min(3).max(255),
  password: z.string().min(8).max(100),
});

export const signIn = validatedAction(signInSchema, async (data, formData) => {
  const { email, password } = data;

  const userWithTeam = await prisma.user.findFirst({
    where: { email, deletedAt: null },
    include: { teams: { include: { team: true } } },
  });

  if (!userWithTeam) {
    return { error: "Invalid email or password. Please try again." };
  }
  if (!userWithTeam.passwordHash) {
    return { error: "No password set for this email." };
  }
  const isPasswordValid = await comparePasswords(
    password,
    userWithTeam.passwordHash
  );
  if (!isPasswordValid) {
    return { error: "Invalid email or password. Please try again." };
  }

  // TODO: Handle multiple teams
  const userRole = userWithTeam.teams[0];

  await Promise.all([
    setSession({
      userId: userWithTeam.id,
      teamId: userRole.teamId,
      userRole: userRole.role,
    }),
    logActivity(ActivityType.EMAIL_SIGN_IN),
  ]);

  const redirectTo = formData.get("redirect") as string | null;
  if (redirectTo === "checkout") {
    const priceId = formData.get("priceId") as string;
    return createCheckoutSession({ team: userRole.team, priceId });
  }

  redirect("/dashboard");
});

const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  inviteId: z.string().optional(),
});

export const signUp = validatedAction(signUpSchema, async (data, formData) => {
  const { email, password, inviteId } = data;

  const existingUser = await prisma.user.findFirst({
    where: { email, deletedAt: null },
  });
  if (existingUser) {
    return { error: "Failed to create user. User already exists." };
  }

  // Create new user
  const passwordHash = await hashPassword(password);
  const createdUser = await prisma.user.create({
    data: {
      email,
      passwordHash,
    },
  });
  if (!createdUser) {
    return { error: "Failed to create user. Please try again." };
  }

  let logs: Promise<void>[] = [];
  let team: Team | null = null;

  if (inviteId) {
    // If user was invited, assign it to new team
    // Check if there's a valid invitation
    const invitation = await prisma.invitation.findFirst({
      where: {
        id: inviteId,
        email,
        status: InvitationStatus.PENDING,
      },
      include: { team: true },
    });
    if (!invitation) {
      return { error: "Invalid or expired invitation." };
    }

    await Promise.all([
      prisma.teamMember.create({
        data: {
          userId: createdUser.id,
          teamId: invitation.teamId,
          role: invitation.role,
        },
      }),
      prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.ACCEPTED },
      }),
    ]);

    team = invitation.team;
    logs.push(logActivity(ActivityType.ACCEPT_INVITATION));
  } else {
    // Create a new team if there's no invitation
    const newTeam = await prisma.team.create({
      data: { name: `Personal Account` },
    });
    if (!newTeam) {
      return { error: "Failed to create team. Please try again." };
    }
    await prisma.teamMember.create({
      data: {
        userId: createdUser.id,
        teamId: newTeam.id,
        role: UserRole.ADMIN,
      },
    });

    team = newTeam;
    logs.push(logActivity(ActivityType.CREATE_TEAM));
  }

  await setSession({
    userId: createdUser.id,
    teamId: team.id,
    userRole: UserRole.ADMIN,
  });

  logs.push(logActivity(ActivityType.EMAIL_SIGN_UP));
  await Promise.all(logs);

  const redirectTo = formData.get("redirect") as string | null;
  if (redirectTo === "checkout") {
    const priceId = formData.get("priceId") as string;
    return createCheckoutSession({ team, priceId });
  }

  redirect("/dashboard");
});

export async function signOut() {
  await logActivity(ActivityType.SIGN_OUT);
  cookies().delete("session");
}

const updatePasswordSchema = z
  .object({
    currentPassword: z.string().min(8).max(100),
    newPassword: z.string().min(8).max(100),
    confirmPassword: z.string().min(8).max(100),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export const updatePassword = validatedActionWithUser(
  updatePasswordSchema,
  async (data, _, user) => {
    const { currentPassword, newPassword } = data;
    if (!user.passwordHash) {
      return { error: "No password set for this account" };
    }

    const isPasswordValid = await comparePasswords(
      currentPassword,
      user.passwordHash
    );
    if (!isPasswordValid) {
      return { error: "Current password is incorrect." };
    }

    if (currentPassword === newPassword) {
      return {
        error: "New password must be different from the current password.",
      };
    }

    const newPasswordHash = await hashPassword(newPassword);
    await Promise.all([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: newPasswordHash },
      }),
      logActivity(ActivityType.UPDATE_PASSWORD),
    ]);

    return { success: "Password updated successfully." };
  }
);

const deleteAccountSchema = z.object({
  password: z.string().min(8).max(100),
});

export const deleteAccount = validatedActionWithUser(
  deleteAccountSchema,
  async (data, _, user) => {
    const { password } = data;
    if (!user.passwordHash) {
      return { error: "No password set for this account" };
    }

    const isPasswordValid = await comparePasswords(password, user.passwordHash);
    if (!isPasswordValid) {
      return { error: "Incorrect password. Account deletion failed." };
    }

    await logActivity(ActivityType.DELETE_ACCOUNT);

    // Soft delete
    await prisma.user.update({
      where: { id: user.id },
      data: {
        email: `${user.email}-deleted`,
        githubId: null,
        googleId: null,
        deletedAt: new Date(),
      },
    });

    cookies().delete("session");
    redirect("/sign-in");
  }
);

const updateAccountSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email address"),
});

export const updateAccount = validatedActionWithUser(
  updateAccountSchema,
  async (data, _, user) => {
    const { name, email } = data;

    const existingUserWithEmail = await prisma.user.findFirst({
      where: { email, deletedAt: null },
    });
    if (existingUserWithEmail) {
      return { error: "Failed to update account. Email already in use." };
    }

    await Promise.all([
      prisma.user.update({
        where: { id: user.id },
        data: { name, email },
      }),
      logActivity(ActivityType.UPDATE_ACCOUNT),
    ]);

    return { success: "Account updated successfully." };
  }
);

const removeTeamMemberSchema = z.object({
  memberId: z.string(),
});

export const removeTeamMember = validatedAction(
  removeTeamMemberSchema,
  async (data, _) => {
    const { memberId } = data;
    const session = await getSession();
    if (!session?.teamId) {
      return { error: "No valid team found." };
    }

    const res = await prisma.teamMember.deleteMany({
      where: { userId: memberId, teamId: session!.teamId },
    });
    if (res.count === 0) {
      return { error: "User is not part of this team." };
    }

    await logActivity(ActivityType.REMOVE_TEAM_MEMBER);

    return { success: "Team member removed successfully" };
  }
);

const inviteTeamMemberSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(["member", "owner"]),
});

export const inviteTeamMember = validatedAction(
  inviteTeamMemberSchema,
  async (data, _) => {
    const { email, role } = data;
    const session = await getSession();
    if (!session?.teamId) {
      return { error: "No valid team found." };
    }

    const existingMember = await prisma.teamMember.findFirst({
      where: { user: { email }, teamId: session!.teamId },
      include: { user: true },
    });
    if (existingMember) {
      return { error: "User is already a member of this team" };
    }

    // Check if there's an existing invitation
    const existingInvitation = await prisma.invitation.findFirst({
      where: {
        email,
        teamId: session!.teamId,
        status: InvitationStatus.PENDING,
      },
    });
    if (existingInvitation) {
      return { error: "An invitation has already been sent to this email" };
    }

    // Create a new invitation
    await prisma.invitation.create({
      data: {
        teamId: session!.teamId,
        email,
        role: role === "member" ? UserRole.MEMBER : UserRole.ADMIN,
        invitedBy: session!.userId,
        status: InvitationStatus.PENDING,
      },
    });
    await logActivity(ActivityType.INVITE_TEAM_MEMBER);

    // TODO: Send invitation email and include ?inviteId={id} to sign-up URL
    // await sendInvitationEmail(email, userWithTeam.team.name, role)

    return { success: "Invitation sent successfully" };
  }
);
