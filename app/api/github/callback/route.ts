import { setSession } from "@/lib/auth/session";
import prisma from "@/lib/db/prisma";
import { Team, UserRole } from "@prisma/client";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.json({ error: "No code provided" }, { status: 400 });
  }

  try {
    const tokenResponse = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: process.env.GITHUB_OAUTH_CLIENT_ID,
          client_secret: process.env.GITHUB_OAUTH_CLIENT_SECRET,
          code,
        }),
      }
    );

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      return NextResponse.json({ error: tokenData.error }, { status: 400 });
    }

    const accessToken = tokenData.access_token;

    // Use the access token to fetch user data
    const [userResponse, orgsResponse] = await Promise.all([
      fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }),
      fetch("https://api.github.com/user/orgs", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }),
    ]);

    const githubUser = await userResponse.json();
    const githubOrgs = await orgsResponse.json();
    console.log("Github user data:", githubUser);
    console.log("Github orgs data:", githubOrgs);

    const user = await createOrUpdateUser(githubUser);

    const teams = await Promise.all(
      [githubUser, ...githubOrgs].map(({ login, id }) =>
        createOrUpdateTeam(user.id, login, String(id))
      )
    );
    if (!teams.length) {
      return NextResponse.json({ error: "No teams found" }, { status: 500 });
    }

    // Auth the user
    await setSession({
      userId: user.id,
      teamId: teams[0]?.id,
      userRole: UserRole.ADMIN,
    });

    // Redirect to dashboard or home page after successful login
    return NextResponse.redirect(`${process.env.BASE_URL}/dashboard`);
  } catch (error) {
    console.error("Error during GitHub OAuth:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 }
    );
  }
}

async function createOrUpdateTeam(
  userId: string,
  login: string,
  githubId: string
): Promise<Team> {
  const existingTeam = await prisma.team.findFirst({
    where: { githubId },
    include: { members: true },
  });
  if (existingTeam) {
    const member = existingTeam.members.find(
      (member) => member.userId === userId
    );
    if (member && member.role !== UserRole.ADMIN) {
      // Add user as admin
      await prisma.teamMember.update({
        where: { id: member.id },
        data: {
          role: UserRole.ADMIN,
        },
      });
    } else if (!member) {
      await prisma.teamMember.create({
        data: {
          userId,
          teamId: existingTeam.id,
          role: UserRole.ADMIN,
        },
      });
    }
    return existingTeam;
  }

  const createdTeam = await prisma.team.create({
    data: {
      name: login,
      githubId,
    },
  });
  await prisma.teamMember.create({
    data: {
      userId,
      teamId: createdTeam.id,
      role: UserRole.ADMIN,
    },
  });
  return createdTeam;
}

async function createOrUpdateUser(githubUser: any) {
  const githubId = String(githubUser.id);

  // Check if user already exists
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ githubId }, { email: githubUser.email }],
    },
  });
  if (existingUser) {
    // Update existing user
    const updatedUser = await prisma.user.update({
      where: {
        id: existingUser.id,
      },
      data: {
        githubId,
        name: githubUser.name,
        email: githubUser.email,
        deletedAt: null,
      },
      include: { teams: true },
    });

    if (existingUser.deletedAt) {
      // TODO: Also undelete team
    }
    return updatedUser;
  }

  // Create new user
  const createdUser = await prisma.user.create({
    data: {
      githubId,
      name: githubUser.name,
      email: githubUser.email,
    },
  });

  return createdUser;
}
