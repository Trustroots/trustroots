import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import SearchMap from '@/modules/search/client/components/SearchMap.component';

describe('Search', () => {
  it('Map loads', async () => {
    render(
      <SearchMap
        filters="{}"
        isUserPublic={true}
        onOfferClose={() => {}}
        onOfferOpen={() => {}}
      />,
    );
  });
});
