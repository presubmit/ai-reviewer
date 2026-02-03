/** @type {import('semantic-release').Options} */
module.exports = {
  branches: ["main"],
  tagFormat: "v${version}",
  plugins: [
    ["@semantic-release/commit-analyzer", { preset: "conventionalcommits" }],
    ["@semantic-release/release-notes-generator", { preset: "conventionalcommits" }],
    ["@semantic-release/changelog", { changelogFile: "CHANGELOG.md" }],

    // Updates package.json version but does NOT publish to npm
    ["@semantic-release/npm", { npmPublish: false }],

    ["@semantic-release/git", {
      assets: ["dist/**", "package.json", "pnpm-lock.yaml", "CHANGELOG.md"],
      message: "chore(release): ${nextRelease.version}"
    }],

    "@semantic-release/github"
  ],
};
