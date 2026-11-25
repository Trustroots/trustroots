import { useInfiniteQuery, type InfiniteData } from '@tanstack/react-query';
import { queryPlaceHosts } from '@/modules/offers/client/api/offers.api';
import type {
  PlaceHostPage,
  PlaceHostSort,
} from '@/modules/offers/shared/offer';
import type { MapBounds } from '@/modules/core/client/utils/location';

export default function useCityHosts({
  viewer,
  bounds,
  filters,
  sort,
  canHost,
  enabled,
}: {
  viewer?: string;
  bounds?: MapBounds;
  filters: string;
  sort: PlaceHostSort;
  canHost: boolean;
  enabled: boolean;
}) {
  return useInfiniteQuery<
    PlaceHostPage,
    Error,
    InfiniteData<PlaceHostPage, number>,
    readonly unknown[],
    number
  >({
    queryKey: ['city-hosts', viewer, bounds, filters, sort, canHost],
    enabled: Boolean(bounds) && enabled,
    staleTime: 60_000,
    initialPageParam: 0,
    getNextPageParam: page => page.nextOffset,
    queryFn: ({ pageParam, signal }) =>
      queryPlaceHosts(
        {
          northEastLat: bounds!.northEast.lat,
          northEastLng: bounds!.northEast.lng,
          southWestLat: bounds!.southWest.lat,
          southWestLng: bounds!.southWest.lng,
          filters,
          sort,
          canHost,
          offset: pageParam,
        },
        signal,
      ),
  });
}
