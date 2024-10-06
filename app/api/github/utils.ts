import { Octokit } from "@octokit/rest";
import fs from "fs";
import { createAppAuth } from "@octokit/auth-app";

// Load your private key
const privateKey = fs.readFileSync("keys/github.private-key.pem", "utf8");
const githubAuth = createAppAuth({
  appId: process.env.GITHUB_APP_ID!,
  privateKey: privateKey,
});

const tokenCache = new Map<string, { token: string; expiration: number }>();

export async function getInstallationOctokit(installationId: number) {
  const now = Math.floor(Date.now() / 1000);
  const installationKey = installationId.toString();

  // Check if the cached token is still valid
  if (tokenCache.has(installationKey)) {
    const { token, expiration } = tokenCache.get(installationKey)!;
    if (expiration > now) {
      return new Octokit({
        auth: token,
      });
    }
  }

  const installationAuth = await githubAuth({
    type: "installation",
    installationId: installationId,
  });
  const { token } = installationAuth;

  // Cache the new token
  const expiration = now + 3600; // Set expiration time (1 hour)
  tokenCache.set(installationKey, { token, expiration });

  return new Octokit({
    auth: token,
  });
}

// // Function to remove installation
// async function removeInstallation(installationId: number) {
//   try {
//     // Make the API call to delete the installation
//     await appOctokit.octokit.request(
//       `DELETE /app/installations/${installationId}`
//     );
//     console.log(`Installation ${installationId} removed successfully.`);
//   } catch (error) {
//     console.error("Error removing installation:", error);
//   }
// }
