import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import '@/config/client/i18n';

import SearchMap from '@/modules/search/client/components/SearchMap.component';
// import * as tribesApi from '@/modules/tribes/client/api/tribes.api';

// jest.mock('@/modules/tribes/client/api/tribes.api');
// jest.mock('@/modules/core/client/services/angular-compat');

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
