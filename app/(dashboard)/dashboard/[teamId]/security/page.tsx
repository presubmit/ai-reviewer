import { notFound } from "next/navigation";
import { TeamParams } from "@/lib/utils";
import { getTeamAccess } from "@/lib/auth/session";
import Security from "./security";

export default async function SecurityPage({ params }: { params: TeamParams }) {
  const teamAccess = await getTeamAccess(params);
  if (!teamAccess) {
    return notFound();
  }

  return <Security />;
}
