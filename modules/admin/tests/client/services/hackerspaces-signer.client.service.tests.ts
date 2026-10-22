import { nip19 } from 'nostr-tools';
import http from '@/modules/core/client/api/http-client.js';
import { fetchSigningIdentity } from '@/modules/admin/client/services/hackerspaces-signer.client.service';

jest.mock('@/modules/core/client/api/http-client.js', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));
const publicKey = 'a'.repeat(64);
const get = jest.mocked(http.get);
beforeEach(() => jest.resetAllMocks());

it('looks up the matching Trustroots identity with the connected public key', async () => {
  get.mockResolvedValue({ data: { nip05: 'workshop@trustroots.org' } });
  expect(await fetchSigningIdentity(publicKey)).toEqual({
    publicKey,
    npub: nip19.npubEncode(publicKey),
    nip05: 'workshop@trustroots.org',
  });
  expect(get).toHaveBeenCalledWith('/api/admin/hackerspaces/signer', {
    params: { publicKey },
  });
});

it('keeps the key usable when no eligible Trustroots account matches', async () => {
  get.mockResolvedValue({ data: { nip05: null } });
  expect(await fetchSigningIdentity(publicKey)).toEqual({
    publicKey,
    npub: nip19.npubEncode(publicKey),
  });
});

it('distinguishes a failed lookup from an absent identity', async () => {
  get.mockRejectedValue(new Error('unavailable'));
  expect(await fetchSigningIdentity(publicKey)).toEqual({
    publicKey,
    npub: nip19.npubEncode(publicKey),
    lookupFailed: true,
  });
});
