<div align="center">
  <h1>
    Presubmit - AI Code Reviewer
  </h1>
  
  <p><em>Context-aware, intelligent and instant PR reviews</em></p>

[![GitHub Stars](https://img.shields.io/github/stars/presubmit/ai-reviewer?style=social)](https://github.com/presubmit/ai-reviewer/stargazers) &nbsp;
[![GitHub last commit](https://img.shields.io/github/last-commit/presubmit/ai-reviewer)](https://github.com/presubmit/ai-reviewer/commits) &nbsp;
[![GitHub License](https://img.shields.io/github/license/presubmit/ai-reviewer?color=yellow)](https://github.com/presubmit/ai-reviewer/blob/main/LICENSE) &nbsp;
[![X (formerly Twitter) Follow](https://img.shields.io/twitter/follow/presubmitai?style=social)](https://x.com/intent/follow?screen_name=presubmitai)

</div>

<br/>

Optimize your code review process with Presubmit's AI Code Reviewer that catches bugs, suggests improvements, and provides meaningful summary - all before human reviewers take their first look.

- 🔍 **Instant, In-depth PR Analysis**: Catches bugs, security issues, and optimization opportunities in real-time
- 🎯 **Focus on What Matters**: Let AI handle the basics while humans focus on architecture and complex logic
- ✨ **Title and description generation**: Save time by having the AI generate meaningful title and description for your PR
- 💬 **Interactive & Smart**: Responds to questions and generates code suggestions right in your PR
- ⚡ **Lightning-Fast Setup**: Up and running in 2 minutes with GitHub Actions

<br/>

kaslhdoiasdahosadoisadsioiaojds

> 🤝 **Note**: Presubmit is designed to complement human reviewers, not replace them. It helps catch security issues and bugs early on while also providing context about the overall change, making the human review process more efficient.

<br/>

## See it in Action

> 💡 [View full example PR review](https://github.com/presubmit/ebank-backend/pull/13)

Automated analysis detects potential issues and provides actionable insights:

<div align="left">
  <a href="https://github.com/presubmit/ebank-backend/pull/13">
    <img src="https://github.com/presubmit/ai-reviewer/blob/main/assets/review_example_3.png?raw=true" alt="AI Code Review example" width="650"/>
  </a>
</div>

<br/>

Interactive discussions help clarify implementation details:

<div align="left">
  <a href="https://github.com/presubmit/ebank-backend/pull/13">
    <img src="https://github.com/presubmit/ai-reviewer/blob/main/assets/comment_example.png?raw=true" alt="AI comment thread example" width="650"/>
  </a>
</div>

<br/>

## Usage

### Step 1: Add LLM_API_KEY secret

1. Go to your repository's Settings > Secrets and Variables > Actions
2. Click "New repository secret"
3. Add a new secret with:
   - Name: `LLM_API_KEY`
   - Value: Your API key from one of these providers:
     - [Anthropic Console](https://console.anthropic.com/) (Claude)
     - [OpenAI API](https://platform.openai.com/api-keys) (GPT-4)
     - [Google AI Studio](https://aistudio.google.com/app/apikeys) (Gemini)

### Step 2: Create GitHub Workflow

Add this GitHub Action to your repository by creating `.github/workflows/presubmit.yml`:

```yaml
name: Presubmit.ai

permissions:
  contents: read
  pull-requests: write
  issues: write

on:
  pull_request:
  pull_request_review_comment:
    types: [created]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: presubmit/ai-reviewer@latest
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          LLM_API_KEY: ${{ secrets.LLM_API_KEY }}
          LLM_MODEL: "claude-3-5-sonnet-20241022"
```

The action requires:

- `GITHUB_TOKEN`: Automatically provided by GitHub Actions
- `LLM_API_KEY`: Your API key (added in step 1)
- `LLM_MODEL`: Which LLM model to use. Make sure the model is [supported](https://github.com/presubmit/ai-reviewer/blob/main/src/ai.ts) and matches the `LLM_API_KEY`.

<br/>

## Features

### 🤖 Smart Reviews

- **In-depth Analysis**: Line-by-line review with context-aware suggestions
- **Auto PR Summary**: Concise, meaningful summaries of changes
- **Code Quality**: Catches bugs, anti-patterns, and style issues
- **Interactive**: Responds to questions and clarifications in comments

### 🛡️ Security & Quality

- **Vulnerability Detection**: Catches security issues and leaked
  secrets
- **Best Practices**: Enforces coding standards and security
  guidelines
- **Performance**: Identifies potential bottlenecks and optimizations
- **Documentation**: Ensures proper code documentation and clarity

### ⚙️ Configurable

- Mention `@presubmit` in PR title for auto-generation
- Disable reviews with `@presubmit ignore` comment
- Configurable review depth and focus areas
- Customizable rules and preferences

### ⚡ Seamless Integration

- 2-minute setup with GitHub Actions
- Works with all major LLM providers (Claude, GPT-4, Gemini)
- Instant feedback on every PR
- Zero maintenance required

<br/>

## Show Your Support! ⭐

If you find Presubmit helpful in improving the review process:

- **Star this repository** to show your support and help others discover it
- Share your experience by creating a [GitHub Issue](https://github.com/presubmit/ai-reviewer/issues)
- Follow me on [X/Twitter](https://x.com/bdstanga) for updates
- Consider [contributing](CONTRIBUTING.md) to make it even better
