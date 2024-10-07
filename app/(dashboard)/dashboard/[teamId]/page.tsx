import { getTeamAccess } from "@/lib/auth/session";
import { Overview } from "./overview";
import { notFound } from "next/navigation";
import { TeamParams } from "@/lib/utils";

export default async function OverviewPage({ params }: { params: TeamParams }) {
  const teamAccess = await getTeamAccess(params);
  if (!teamAccess) {
    return notFound();
  }

  return <Overview />;
}
