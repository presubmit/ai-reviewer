import { getBooleanInput, getInput } from "@actions/core";

export class Config {
  public githubToken: string | undefined;
  public enablePrSummary: boolean;
  public enableCodeReview: boolean;
  public enableTitleGeneration: boolean;

  constructor() {
    this.githubToken = process.env.GITHUB_TOKEN;
    this.enablePrSummary = true;
    this.enableCodeReview = true;
    this.enableTitleGeneration = true;
  }

  public loadInputs() {
    if (process.env.DEBUG) {
      console.log("[debug] skip loading inputs");
      return;
    }
    this.enablePrSummary = getBooleanInput("enable_pr_summary");
    this.enableCodeReview = getBooleanInput("enable_code_review");
    this.enableTitleGeneration = getBooleanInput("enable_title_generation");
  }
}

const config = new Config();
config.loadInputs();

export default { config };
