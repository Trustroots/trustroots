/** @jest-environment node */
import { generateKeyPairSync } from 'node:crypto';
import {
  GitHubError,
  installationToken,
  Repository,
} from '../server/github.mts';
import { snapshot } from './fixtures.ts';

function mockFetch() {
  return jest.fn<Promise<Response>, Parameters<typeof fetch>>();
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe('GitHub-backed translation workflow', () => {
  it('exchanges a signed App JWT for a scoped installation token and refreshes it', async () => {
    const { privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });
    const fetcher = mockFetch();
    fetcher.mockResolvedValueOnce(
      json({
        token: 'first',
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      }),
    );
    const token = installationToken(
      { appId: '123', installationId: '456', privateKey },
      fetcher,
    );
    expect(await token()).toBe('first');
    expect(await token()).toBe('first');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetcher.mock.calls[0][1]!.body))).toEqual({
      repositories: ['trustroots'],
      permissions: { contents: 'write', pull_requests: 'write' },
    });
    expect(
      String(
        (fetcher.mock.calls[0][1]!.headers as Record<string, string>)
          .Authorization,
      ),
    ).toMatch(/^Bearer [\w-]+\.[\w-]+\.[\w-]+$/);
    const defaultFetch = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json({}, 403));
    await expect(
      installationToken({ appId: '123', installationId: '456', privateKey })(),
    ).rejects.toBeInstanceOf(GitHubError);
    defaultFetch
      .mockResolvedValueOnce(
        json({ token: 'expired', expires_at: new Date(0).toISOString() }),
      )
      .mockResolvedValueOnce(
        json({
          token: 'renewed',
          expires_at: new Date(Date.now() + 3600000).toISOString(),
        }),
      );
    const renew = installationToken({
      appId: '123',
      installationId: '456',
      privateKey,
    });
    expect(await renew()).toBe('expired');
    expect(await renew()).toBe('renewed');
    defaultFetch.mockRestore();
  });

  it('reads JSON snapshots at a fixed revision, includes feedback and deduplicates languages', async () => {
    const state = snapshot();
    const fetcher = mockFetch();
    const paths = [
      'unrelated.txt',
      'public/locales/en/users.json',
      'public/locales/en/pages.json',
      'public/locales/de/users.json',
      'apps/nostranslation/reviews/de.json',
    ];
    const contents: Record<string, unknown> = {
      'config/shared/locales.json': [
        ...state.languages,
        state.languages[0],
        { code: 'en', label: 'English', english: 'English' },
      ],
      'public/locales/en/users.json': state.source.users,
      'public/locales/en/pages.json': { About: 'About' },
      'public/locales/de/users.json': state.target.users,
      'apps/nostranslation/reviews/de.json': {
        'users:Hello': { value: 'Hallo' },
      },
    };
    fetcher.mockImplementation(async input => {
      const path = String(input).split('/trustroots/')[1];
      if (path === 'commits/main') return json({ sha: state.revision });
      if (path.startsWith('git/trees/'))
        return json({ tree: paths.map(path => ({ path })), truncated: false });
      const name = path.replace(/^contents\//, '').split('?')[0];
      return json({
        content: Buffer.from(JSON.stringify(contents[name])).toString('base64'),
      });
    });
    const repository = new Repository(async () => 'token', fetcher);
    expect(await repository.languages()).toEqual(state.languages);
    const loaded = await repository.load('de');
    expect(loaded).toMatchObject({
      revision: state.revision,
      target: { users: state.target.users, pages: {} },
      reviews: { 'users:Hello': { value: 'Hallo' } },
    });
    expect(
      fetcher.mock.calls
        .filter(call => String(call[0]).includes('public/locales/'))
        .every(call => String(call[0]).includes(state.revision)),
    ).toBe(true);
    await expect(repository.load('en')).rejects.toThrow('Unsupported');
    await expect(repository.load('../../x')).rejects.toThrow('Unsupported');
    fetcher.mockImplementation(async input =>
      String(input).includes('commits/main')
        ? json({ sha: 'sha' })
        : String(input).includes('contents/')
          ? json({
              content: Buffer.from(JSON.stringify(state.languages)).toString(
                'base64',
              ),
            })
          : json({ tree: [], truncated: true }),
    );
    await expect(repository.load('de')).rejects.toThrow('incomplete');
    fetcher.mockImplementation(async input =>
      String(input).includes('commits/main')
        ? json({ sha: 'sha' })
        : String(input).includes('contents/')
          ? json({
              content: Buffer.from(JSON.stringify(state.languages)).toString(
                'base64',
              ),
            })
          : json({ tree: [], truncated: false }),
    );
    expect((await repository.load('de')).reviews).toEqual({});
  });

  it('creates a draft PR from a new tree without updating main', async () => {
    const fetcher = mockFetch();
    for (const body of [
      [],
      null,
      { tree: { sha: 'base-tree' } },
      { sha: 'tree' },
      { sha: 'commit' },
      {},
      { html_url: 'https://github.com/Trustroots/trustroots/pull/99999' },
    ]) {
      fetcher.mockResolvedValueOnce(json(body, body === null ? 404 : 200));
    }
    const repository = new Repository(async () => 'token', fetcher);
    const files = [{ path: 'public/locales/de/users.json', content: '{}' }];
    expect(
      await repository.publish(
        'codex/translation-test',
        'revision',
        files,
        'fictional@trustroots.org',
      ),
    ).toContain('/pull/');
    const writes = fetcher.mock.calls
      .filter(call => call[1]?.method === 'POST')
      .map(call => [String(call[0]), JSON.parse(String(call[1]!.body))]);
    expect(writes).toEqual([
      [
        expect.stringContaining('/git/trees'),
        {
          base_tree: 'base-tree',
          tree: [{ ...files[0], mode: '100644', type: 'blob' }],
        },
      ],
      [
        expect.stringContaining('/git/commits'),
        expect.objectContaining({ tree: 'tree', parents: ['revision'] }),
      ],
      [
        expect.stringContaining('/git/refs'),
        { ref: 'refs/heads/codex/translation-test', sha: 'commit' },
      ],
      [
        expect.stringContaining('/pulls'),
        expect.objectContaining({
          draft: true,
          base: 'main',
          head: 'codex/translation-test',
        }),
      ],
    ]);
  });

  it('recovers existing PRs and committed branches after uncertain outcomes', async () => {
    const fetcher = mockFetch();
    const repository = new Repository(async () => 'token', fetcher);
    fetcher.mockResolvedValueOnce(
      json([
        { html_url: 'https://github.com/Trustroots/trustroots/pull/99999' },
      ]),
    );
    expect(
      await repository.publish(
        'codex/translation-test',
        'revision',
        [],
        'fictional',
      ),
    ).toContain('/pull/');
    expect(fetcher).toHaveBeenCalledTimes(1);
    fetcher
      .mockResolvedValueOnce(json([]))
      .mockResolvedValueOnce(json({}))
      .mockResolvedValueOnce(
        json({
          html_url: 'https://github.com/Trustroots/trustroots/pull/99999',
        }),
      );
    await repository.publish(
      'codex/translation-test',
      'revision',
      [],
      'fictional',
    );
    expect(fetcher).toHaveBeenCalledTimes(4);
    fetcher
      .mockResolvedValueOnce(json([]))
      .mockResolvedValueOnce(json({}, 500));
    await expect(
      repository.publish('codex/translation-test', 'revision', [], 'fictional'),
    ).rejects.toMatchObject({ status: 500 });
    fetcher
      .mockResolvedValueOnce(json([]))
      .mockRejectedValueOnce(new Error('offline'));
    await expect(
      repository.publish('codex/translation-test', 'revision', [], 'fictional'),
    ).rejects.toThrow('offline');
  });

  it('uses native fetch by default and propagates failed reads', async () => {
    const fetcher = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json({}, 503));
    await expect(
      new Repository(async () => 'token').languages(),
    ).rejects.toMatchObject({ status: 503 });
    fetcher.mockRestore();
  });
});
