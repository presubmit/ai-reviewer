# Contributing

Thank you for your interest in contributing to Presubmit AI Reviewer!

## Getting Started

1. Fork the repository
2. Clone your fork locally
3. Install dependencies with `pnpm install`
4. Create a new branch for your feature/fix: `git checkout -b feature-name`

## Development Setup

### Prerequisites

- Node.js (LTS version recommended) + Typescript
- [Github personal access token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)
- LLM API key from OpenAI, Anthropic or GoogleAI
- (recommended) pnpm package manager

## Development Workflow

1. Make your changes in a feature branch
2. Commit your changes using conventional commits:
   - `feat: add new feature`
   - `fix: resolve bug`
   - `docs: update documentation`
   - `test: add tests`
   - `refactor: improve code structure`
3. Open Pull Request against main repo

## Testing

1. Copy the `.env.example` file to `.env`:

   ```bash
   cp .env.example .env
   ```

2. Configure your environment variables in `.env`:

   ```env
   # Optional: Choose your AI provider (default: ai-sdk, or sap-ai-sdk)
   LLM_PROVIDER=ai-sdk

   # Required: Set your API key and model based on the chosen provider
   LLM_API_KEY=...
   LLM_MODEL=...

   # Required: Github personal access token
   GITHUB_TOKEN=...
   ```

   And uncomment one of the events that you want to test: `pull_request` or `pull_request_review_comment`

3. Run `pnpm dev` to test the updated reviewer in the Pull Request specied in .env

## Pull Request Process

1. Update the README.md with details of significant changes if applicable
2. Ensure your PR description clearly describes the problem and solution
3. Link any related issues using GitHub keywords (e.g., "Fixes #123")
4. Make sure all checks pass on your PR
5. Request review from maintainers

## Questions or Need Help?

- Open an issue for questions
- Join our community discussions
- Reach out on [X/Twitter](https://x.com/bdstanga)

## License

By contributing to AI PR Reviewer, you agree that your contributions will be licensed under the same license as the project.

Thank you for contributing to make AI PR Reviewer better! 🚀
