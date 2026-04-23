import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { PullRequestInfo } from './types';

const PR_PATH_RE = /^([^/\s]+)\/([^/\s]+)\/pull\/(\d+)$/;
const BARE_NUM_RE = /^\d+$/;
const GH_PR_URL_RE = /https:\/\/github\.com\/[^\s]+\/pull\/\d+/;

export type PrPathParts = { owner: string; repo: string; number: number };

export function parsePrPath(
  prPath: string,
  fallbackRepo?: string,
): PrPathParts | null {
  const m = prPath.match(PR_PATH_RE);
  if (m) return { owner: m[1], repo: m[2], number: Number(m[3]) };
  if (fallbackRepo && BARE_NUM_RE.test(prPath)) {
    const [owner, repo] = fallbackRepo.split('/');
    if (owner && repo) return { owner, repo, number: Number(prPath) };
  }
  return null;
}

const exec = promisify(execFile);

export type GhPrCreateResult =
  | { kind: 'created'; url: string }
  | { kind: 'already-exists' }
  | { kind: 'error'; stdout: string; stderr: string };

async function runGhPrCreate(args: {
  cwd: string;
  title: string;
  body: string;
  mergeBranch?: string;
}): Promise<GhPrCreateResult> {
  const cmdArgs = ['pr', 'create', '--title', args.title, '--body', args.body];
  if (args.mergeBranch) cmdArgs.push('--base', args.mergeBranch);
  try {
    const { stdout } = await exec('gh', cmdArgs, { cwd: args.cwd });
    const match = GH_PR_URL_RE.exec(stdout);
    if (!match) return { kind: 'error', stdout, stderr: '' };
    return { kind: 'created', url: match[0] };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string };
    const stderr = e.stderr ?? '';
    const stdout = e.stdout ?? '';
    if (stderr.includes('already exists')) return { kind: 'already-exists' };
    return { kind: 'error', stdout, stderr };
  }
}

async function runGhPrList(args: {
  cwd: string;
  branch: string;
}): Promise<{ url: string } | null> {
  try {
    const { stdout } = await exec(
      'gh',
      ['pr', 'list', '--head', args.branch, '--json', 'url', '--limit', '1'],
      { cwd: args.cwd },
    );
    const parsed = JSON.parse(stdout) as { url: string }[];
    return parsed[0] ?? null;
  } catch {
    return null;
  }
}

async function getCurrentBranch(cwd: string): Promise<string | null> {
  try {
    const { stdout } = await exec('git', ['branch', '--show-current'], { cwd });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

export const _runner = { runGhPrCreate, runGhPrList, getCurrentBranch };

export async function fetchPullRequest(
  parts: PrPathParts,
): Promise<PullRequestInfo | null> {
  try {
    const { stdout } = await exec('gh', [
      'pr',
      'view',
      String(parts.number),
      '--repo',
      `${parts.owner}/${parts.repo}`,
      '--json',
      'number,title,state',
    ]);
    const raw = JSON.parse(stdout) as { number: number; title: string; state: string };
    return {
      url: `https://github.com/${parts.owner}/${parts.repo}/pull/${parts.number}`,
      number: raw.number,
      title: raw.title,
      state: raw.state,
    };
  } catch (err) {
    console.warn(
      `[github] gh pr view failed for ${parts.owner}/${parts.repo}#${parts.number}`,
      err,
    );
    return null;
  }
}
