import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { PullRequestInfo } from './types';

const PR_PATH_RE = /^([^/\s]+)\/([^/\s]+)\/pull\/(\d+)$/;
const BARE_NUM_RE = /^\d+$/;

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
