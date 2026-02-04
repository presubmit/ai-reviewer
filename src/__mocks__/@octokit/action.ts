export class Octokit {
  constructor(options?: any) {}

  // Add any methods your tests need
  rest = {
    repos: {},
    pulls: {},
    issues: {},
    // Add other REST API methods as needed
  };

  // Add static plugin method
  static plugin(...plugins: any[]) {
    return Octokit;
  }
}
