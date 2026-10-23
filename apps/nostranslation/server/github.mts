import { sign } from 'node:crypto';
import type { Language } from '../shared.ts';
import type { Review, Snapshot, Strings } from './catalogue.mts';

export class GitHubError extends Error {
  readonly status: number;
  constructor(status: number) {
    super('GitHub request failed.');
    this.status = status;
  }
}

export interface GitHubConfig {
  appId: string;
  installationId: string;
  privateKey: string;
}

/** Installation tokens and the private key are only used by this server. */
export function installationToken(config: GitHubConfig, fetcher = fetch) {
  let cached: { token: string; expires_at: string } | undefined;
  return async () => {
    if (cached && Date.parse(cached.expires_at) > Date.now() + 60000)
      return cached.token;
    const encode = (value: object) =>
      Buffer.from(JSON.stringify(value)).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ iat: now - 60, exp: now + 540, iss: config.appId })}`;
    const jwt = `${unsigned}.${sign('RSA-SHA256', Buffer.from(unsigned), config.privateKey).toString('base64url')}`;
    const response = await fetcher(
      `https://api.github.com/app/installations/${config.installationId}/access_tokens`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jwt}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify({
          repositories: ['trustroots'],
          permissions: { contents: 'write', pull_requests: 'write' },
        }),
        signal: AbortSignal.timeout(20000),
      },
    );
    if (!response.ok) throw new GitHubError(response.status);
    cached = (await response.json()) as typeof cached;
    return cached!.token;
  };
}

export interface PublishFile {
  path: string;
  content: string;
}

export class Repository {
  private token: () => Promise<string>;
  private fetcher: typeof fetch;
  constructor(token: () => Promise<string>, fetcher = fetch) {
    this.token = token;
    this.fetcher = fetcher;
  }

  async request<T>(path: string, method = 'GET', body?: object): Promise<T> {
    const response = await this.fetcher(
      `https://api.github.com/repos/Trustroots/trustroots/${path}`,
      {
        method,
        headers: {
          Authorization: `Bearer ${await this.token()}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(20000),
      },
    );
    if (!response.ok) throw new GitHubError(response.status);
    return (await response.json()) as T;
  }

  async read<T>(path: string, revision: string): Promise<T> {
    const file = await this.request<{ content: string }>(
      `contents/${path}?ref=${encodeURIComponent(revision)}`,
    );
    return JSON.parse(
      Buffer.from(file.content, 'base64').toString('utf8'),
    ) as T;
  }

  async languages() {
    const languages = await this.read<Language[]>(
      'config/shared/locales.json',
      'main',
    );
    return [
      ...new Map(
        languages
          .filter(lang => lang.code !== 'en')
          .map(lang => [lang.code, lang]),
      ).values(),
    ];
  }

  async load(locale: string): Promise<Snapshot> {
    const head = await this.request<{ sha: string }>('commits/main');
    const languages = await this.read<Language[]>(
      'config/shared/locales.json',
      head.sha,
    );
    if (locale === 'en' || !languages.some(lang => lang.code === locale))
      throw new Error('Unsupported target language.');
    const tree = await this.request<{
      tree: { path: string }[];
      truncated: boolean;
    }>(`git/trees/${head.sha}?recursive=1`);
    if (tree.truncated) throw new Error('Repository listing is incomplete.');
    const paths = new Set(tree.tree.map(file => file.path));
    const source: Record<string, Strings> = {};
    const target: Record<string, Strings> = {};
    for (const path of paths) {
      const match = /^public\/locales\/en\/([A-Za-z0-9-]+)\.json$/.exec(path);
      if (!match) continue;
      const namespace = match[1];
      source[namespace] = await this.read<Strings>(path, head.sha);
      const targetPath = `public/locales/${locale}/${namespace}.json`;
      target[namespace] = paths.has(targetPath)
        ? await this.read<Strings>(targetPath, head.sha)
        : {};
    }
    const reviewsPath = `apps/nostranslation/reviews/${locale}.json`;
    const reviews = paths.has(reviewsPath)
      ? await this.read<Record<string, Review>>(reviewsPath, head.sha)
      : {};
    return { revision: head.sha, languages, source, target, reviews };
  }

  async existingPR(branch: string) {
    const prs = await this.request<{ html_url: string }[]>(
      `pulls?state=all&head=Trustroots:${encodeURIComponent(branch)}`,
    );
    return prs[0]?.html_url;
  }

  async publish(
    branch: string,
    revision: string,
    files: PublishFile[],
    identity: string,
  ) {
    const existing = await this.existingPR(branch);
    if (existing) return existing;
    let exists = false;
    try {
      await this.request(`git/ref/heads/${branch}`);
      exists = true;
    } catch (error) {
      if (!(error instanceof GitHubError) || error.status !== 404) throw error;
    }
    if (!exists) {
      const base = await this.request<{ tree: { sha: string } }>(
        `git/commits/${revision}`,
      );
      const tree = await this.request<{ sha: string }>('git/trees', 'POST', {
        base_tree: base.tree.sha,
        tree: files.map(file => ({ ...file, mode: '100644', type: 'blob' })),
      });
      const commit = await this.request<{ sha: string }>(
        'git/commits',
        'POST',
        {
          message: `Update reviewed translations (${identity})`,
          tree: tree.sha,
          parents: [revision],
        },
      );
      await this.request('git/refs', 'POST', {
        ref: `refs/heads/${branch}`,
        sha: commit.sha,
      });
    }
    const pr = await this.request<{ html_url: string }>('pulls', 'POST', {
      title: 'Update human-reviewed translations',
      head: branch,
      base: 'main',
      draft: true,
      body: `## Proposed changes\n\nTranslations proofread and approved by ${identity} using Nostranslation. AI suggestions were reviewed before submission.\n\n## Testing instructions\n\nRun translation validation and normal CI, then review the language changes before merging.`,
    });
    return pr.html_url;
  }
}
