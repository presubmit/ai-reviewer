import { compare, hash } from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { UserRole } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { redirect } from "next/navigation";
import { TeamParams } from "../utils";

const key = new TextEncoder().encode(process.env.AUTH_SECRET);
const SALT_ROUNDS = 10;

export async function hashPassword(password: string) {
  return hash(password, SALT_ROUNDS);
}

export async function comparePasswords(
  plainTextPassword: string,
  hashedPassword: string
) {
  return compare(plainTextPassword, hashedPassword);
}

type UserData = {
  userId: string;
  teamId: string;
  userRole: UserRole;
};

type SessionData = UserData & { expires: string };

export async function signToken(payload: SessionData) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1 day from now")
    .sign(key);
}

export async function verifyToken(input: string) {
  const { payload } = await jwtVerify(input, key, {
    algorithms: ["HS256"],
  });
  return payload as SessionData;
}

export async function getSession(): Promise<SessionData | null> {
  const session = cookies().get("session")?.value;
  if (!session) {
    return null;
  }
  return await verifyToken(session);
}

export async function updateSession(userData: UserData) {
  const exstingSession = await getSession();
  if (!exstingSession) {
    return setSession(userData);
  }
  const session = { ...userData, expires: exstingSession!.expires };
  const encryptedSession = await signToken(session);
  cookies().set("session", encryptedSession, {
    expires: new Date(exstingSession!.expires),
    httpOnly: true,
    secure: true,
    sameSite: "lax",
  });
}

export async function setSession(userData: UserData) {
  const expiresInOneDay = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const session: SessionData = {
    ...userData,
    expires: expiresInOneDay.toISOString(),
  };
  const encryptedSession = await signToken(session);
  cookies().set("session", encryptedSession, {
    expires: expiresInOneDay,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
  });
}

export async function getUser() {
  const session = await getSession();
  if (!session?.userId) {
    return null;
  }

  const user = await prisma.user.findFirst({
    where: { id: session!.userId },
  });
  return user;
}

export async function getTeamAccess(params: TeamParams) {
  const session = await getSession();
  if (!session) {
    redirect("/sign-in");
  }

  const teamId = params.teamId;
  if (!teamId) {
    redirect("/dashboard");
  }

  const teamMember = await prisma.teamMember.findFirst({
    where: { userId: session.userId, teamId },
  });
  if (!teamMember) {
    redirect("/dashboard");
  }
  return teamMember;
}
