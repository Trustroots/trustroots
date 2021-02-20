// External dependencies
import { useTranslation } from 'react-i18next';
import React from 'react';
import styled from 'styled-components';

// Internal dependencies
import NoContent from '@/modules/core/client/components/NoContent';

const Container = styled(NoContent)`
  margin-top: 20px;
`;

export default function SearchResultNone() {
  const { t } = useTranslation('search');

  return (
    <Container icon="users" message={t('Choose something from the map.')} />
  );
}

SearchResultNone.propTypes = {};
