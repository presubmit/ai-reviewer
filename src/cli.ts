import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
// Lazy import pull_request after token resolution to avoid config init before token is set
import { initOctokit } from './octokit';

function loadDotEnvIfExists() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    try { dotenv.config({ path: envPath }); } catch {}
  }
}

function resolveGitHubToken(): string {
  // Some Octokit action auth checks expect this to be set; spoof for local runs
  if (!process.env.GITHUB_ACTION) process.env.GITHUB_ACTION = 'local';
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  loadDotEnvIfExists();
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    const token = execSync('gh auth token', { encoding: 'utf8' }).trim();
    if (token) {
      process.env.GITHUB_TOKEN = token;
      return token;
    }
  } catch {}
  throw new Error('No GITHUB_TOKEN found; set env/.env or run `gh auth login`.');
}

async function listPRs(
  owner: string,
  repo: string,
  state: 'open' | 'closed' | 'all' = 'open',
  limit = 10
) {
  const token = resolveGitHubToken();
  const octokit = initOctokit(token, process.env.GITHUB_API_URL || undefined);
  const all = await octokit.paginate(octokit.rest.pulls.list, { owner, repo, state, per_page: 100 });
  const items = all.slice(0, limit);
  for (const p of items) {
    console.log(`#${p.number} ${p.title} by @${p.user?.login}`);
  }
}

async function reviewPR(
  prNumber: number,
  dryRun: boolean,
  owner: string,
  repo: string,
  full: boolean = false,
  out?: string | boolean
) {
  // Ensure token is available for loadDebugContext
  resolveGitHubToken();

  // Set environment variables for debug mode
  process.env.DEBUG = '1';
  process.env.GITHUB_REPOSITORY = `${owner}/${repo}`;
  process.env.GITHUB_PULL_REQUEST = String(prNumber);
  process.env.GITHUB_EVENT_NAME = 'pull_request';
  process.env.GITHUB_EVENT_ACTION = 'synchronize';

  if (dryRun) {
    process.env.DRY_RUN = '1';
  }

  if (full) {
    process.env.FORCE_FULL_REVIEW = '1';
  }

  // Optional: capture stdout/stderr to file
  let restore: (() => void) | undefined;
  let outPath: string | undefined;
  if (out) {
    outPath = typeof out === 'string' && out.trim().length
      ? (path.isAbsolute(out) ? out : path.join(process.cwd(), out))
      : path.join(process.cwd(), 'dry', `pr-${prNumber}.txt`);
    const chunks: string[] = [];
    const o1 = process.stdout.write.bind(process.stdout);
    const o2 = process.stderr.write.bind(process.stderr);
    (process.stdout.write as any) = (str: any, ...args: any[]) => {
      try { chunks.push(typeof str === 'string' ? str : String(str)); } catch {}
      return o1(str, ...args);
    };
    (process.stderr.write as any) = (str: any, ...args: any[]) => {
      try { chunks.push(typeof str === 'string' ? str : String(str)); } catch {}
      return o2(str, ...args);
    };
    restore = () => {
      (process.stdout.write as any) = o1;
      (process.stderr.write as any) = o2;
      fs.mkdirSync(path.dirname(outPath!), { recursive: true });
      fs.writeFileSync(outPath!, chunks.join(''), 'utf8');
      console.log(`\n[dry-run] Saved output to ${path.relative(process.cwd(), outPath!)}`);
    };
  }

  try {
    const mod = await import('./pull_request');
    await mod.handlePullRequest();
  } finally {
    if (restore) restore();
  }
}

function parseArgs(argv: string[]) {
  const args: Record<string, any> = { _: [] };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];

    if (a === '--dry-run') {
      args.dryRun = true;
    } else if (a === '--full') {
      args.full = true;
    } else if (a === '--list-prs') {
      args.listPrs = true;
    } else if (a === '--state') {
      args.state = argv[++i] as any;
    } else if (a === '--limit') {
      args.limit = parseInt(argv[++i] || '10', 10);
    } else if (a === '--pr') {
      args.pr = parseInt(argv[++i] || '0', 10);
    } else if (a === '--owner') {
      args.owner = argv[++i];
    } else if (a === '--repo') {
      args.repo = argv[++i];
    } else if (a === '--out' || a === '-out') {
      const next = argv[i + 1];
      if (next && !next.startsWith('-')) {
        args.out = next;
        i++;
      } else {
        args.out = true;
      }
    } else {
      args._.push(a);
    }
  }

  return args;
}

export async function main() {
  const args = parseArgs(process.argv.slice(2));
  
  // Extract owner/repo from GITHUB_REPOSITORY env or use defaults
  const defaultRepo = process.env.GITHUB_REPOSITORY || 'presubmit/ai-reviewer';
  const [defaultOwner, defaultRepoName] = defaultRepo.split('/');
  
  const owner = args.owner || defaultOwner;
  const repo = args.repo || defaultRepoName;
  
  if (args.listPrs) {
    await listPRs(owner, repo, args.state || 'open', args.limit || 10);
    return;
  }
  
  if (args.pr) {
    await reviewPR(args.pr, !!args.dryRun, owner, repo, !!args.full, args.out);
    return;
  }

  console.log(`Usage:
  review --list-prs [--owner <owner>] [--repo <repo>] [--state open|closed|all] [--limit N]
  review --pr <number> [--owner <owner>] [--repo <repo>] [--dry-run] [--full] [--out [path] | -out [path]]

Examples:
  review --list-prs --owner presubmit --repo ai-reviewer
  review --pr 123 --dry-run
  review --pr 123 --dry-run --full --out
  review --pr 123 --dry-run --out review-output.txt
  review --pr 123 --owner myorg --repo myrepo

Flags:
  --full          Force a complete re-review (ignores incremental state)
  --out [path]    Save output to file (auto-generates path if not specified)
  --dry-run       Skip GitHub API writes, log what would be posted

Environment:
  Set GITHUB_REPOSITORY=owner/repo to avoid specifying --owner and --repo each time
  Set GITHUB_TOKEN or authenticate with 'gh auth login'
`);
}

if (require.main === module) {
  main().catch((e) => { 
    console.error(e); 
    process.exit(1); 
  });
}

