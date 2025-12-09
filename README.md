# PR Reviewer

AI-powered code reviewer for GitHub pull requests. Reviews code, generates PR summaries, and responds to questions in comment threads.

## Setup

1. Add `LLM_API_KEY` secret in repository Settings > Secrets and Variables > Actions
   - Supports Anthropic (Claude), OpenAI (GPT-4), or Google (Gemini) API keys

2. Create `.github/workflows/pr-reviewer.yml`:

```yaml
name: PR Reviewer

permissions:
  contents: read
  pull-requests: write
  issues: write

on:
  pull_request_target:
    types: [opened, synchronize]
  pull_request_review_comment:
    types: [created]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: shawnd/pr-reviewer@main
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          LLM_API_KEY: ${{ secrets.LLM_API_KEY }}
          LLM_MODEL: "claude-sonnet-4-5"
```

Required environment variables:
- `GITHUB_TOKEN`: Auto-provided by GitHub Actions
- `LLM_API_KEY`: Your API key
- `LLM_MODEL`: Model name matching your API key provider

For GitHub Enterprise Server, add:
```yaml
        env:
          GITHUB_API_URL: "https://github.example.com/api/v3"
          GITHUB_SERVER_URL: "https://github.example.com"
```

## Usage

- Automatically reviews PRs on open/update
- Mention `@review` in PR title to auto-generate title
- Mention `@review` in review comments to get responses
- Add `@review ignore` in PR description to skip review

## Local Testing

Requires Node.js 18+, GitHub CLI (`gh auth login`), and `.env` with `LLM_API_KEY` and `LLM_MODEL`.

```bash
pnpm install && pnpm build

# List PRs
pnpm review -- --list-prs --state open --limit 5

# Review PR (dry-run)
pnpm review -- --pr 123 --dry-run

# Save output
pnpm review -- --pr 123 --dry-run --out

# Specify repo
pnpm review -- --pr 123 --owner myorg --repo myrepo --dry-run
```

Uses `gh auth token` automatically. `--dry-run` skips GitHub API writes. Defaults to `GITHUB_REPOSITORY` env var or `shawnd/pr-reviewer`.
