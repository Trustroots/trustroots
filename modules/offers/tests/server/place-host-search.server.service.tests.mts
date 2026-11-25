import { Types } from 'mongoose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  listPlaceHosts,
  type PlaceHostSearchDocument,
} from '../../server/services/place-host-search.server.service.mts';

describe('City host search age', () => {
  afterEach(() => vi.useRealTimers());

  it.each([
    {
      day: 'February 28 in a non-leap year',
      birthdate: '2000-02-29T12:00:00',
      anniversary: '2025-02-28T12:00:00',
      age: 25,
    },
    {
      day: 'February 29 in a leap year',
      birthdate: '2000-02-29T12:00:00',
      anniversary: '2024-02-29T12:00:00',
      age: 24,
    },
    {
      day: 'February 29 for a February 28 birthdate',
      birthdate: '1999-02-28T12:00:00',
      anniversary: '2024-02-29T12:00:00',
      age: 25,
    },
    {
      day: 'a regular birthday',
      birthdate: '2000-06-15T12:00:00',
      anniversary: '2025-06-15T12:00:00',
      age: 25,
    },
  ])(
    'increments at the birth time on $day',
    async ({ birthdate, anniversary, age }) => {
      const host: PlaceHostSearchDocument = {
        _id: new Types.ObjectId(),
        type: 'host',
        user: {
          _id: new Types.ObjectId(),
          username: 'host',
          birthdate: new Date(birthdate),
        },
        location: [0, 0],
        activity: 'older',
        experienceCount: 0,
      };
      const aggregate = async () => [host];
      const anniversaryTime = new Date(anniversary).getTime();

      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(anniversaryTime - 1);
      const before = await listPlaceHosts(aggregate, [], {});
      expect(before.offers[0]?.age).toBe(age - 1);

      vi.setSystemTime(anniversaryTime);
      const at = await listPlaceHosts(aggregate, [], {});
      expect(at.offers[0]?.age).toBe(age);
    },
  );
});
