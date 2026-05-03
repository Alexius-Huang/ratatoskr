export type MergeMethod = 'squash' | 'rebase' | 'merge';

export type MergeRequest = {
  owner: string;
  repo: string;
  pullNumber: number;
  mergeMethod?: MergeMethod;
};

type MergeErrorKind = 'no-token' | 'unauthorized' | 'not-mergeable' | 'gone' | 'unknown';

export type MergeResponse =
  | { ok: true; sha: string }
  | { ok: false; status: number; envelope: { kind: MergeErrorKind; message?: string } };

type Deps = {
  token: string | null;
  fetchImpl?: typeof fetch;
};

function mapGithubStatus(status: number, message?: string): MergeResponse {
  if (status === 401 || status === 403) {
    return { ok: false, status: 401, envelope: { kind: 'unauthorized', message } };
  }
  if (status === 405 || status === 409) {
    return { ok: false, status: 409, envelope: { kind: 'not-mergeable', message } };
  }
  if (status === 404 || status === 422) {
    return { ok: false, status: 404, envelope: { kind: 'gone', message } };
  }
  return { ok: false, status: 502, envelope: { kind: 'unknown', message } };
}

export async function mergePullRequest(req: MergeRequest, deps: Deps): Promise<MergeResponse> {
  const { token, fetchImpl = fetch } = deps;

  if (!token) {
    return { ok: false, status: 412, envelope: { kind: 'no-token' } };
  }

  const { owner, repo, pullNumber, mergeMethod = 'squash' } = req;
  const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}/merge`;

  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({ merge_method: mergeMethod }),
    });
  } catch {
    return { ok: false, status: 502, envelope: { kind: 'unknown', message: 'Network error reaching GitHub' } };
  }

  if (res.status === 200) {
    const data = await res.json() as { sha: string };
    return { ok: true, sha: data.sha };
  }

  let message: string | undefined;
  try {
    const body = await res.json() as { message?: string };
    message = body.message;
  } catch {
    // ignore parse failure
  }

  return mapGithubStatus(res.status, message);
}
