import { redirect } from "next/navigation";

export default function GitHubAuthPage() {
  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
  const redirectUri = `${process.env.BASE_URL}/api/github/callback`;
  const scope = "user:email read:org";

  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&scope=${scope}`;

  redirect(githubAuthUrl);
}
