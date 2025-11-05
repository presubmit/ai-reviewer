export class Octokit {
  static __lastOptions: any;

  constructor(options?: any) {
    (Octokit as any).__lastOptions = options;
  }

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