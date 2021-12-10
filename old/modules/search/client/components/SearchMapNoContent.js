// External dependencies
import { useTranslation } from 'react-i18next';
import React from 'react';
import styled from 'styled-components';

// Internal dependencies
import NoContent from '@/modules/core/client/components/NoContent';

const Container = styled(NoContent)`
  margin: 0 auto;
  height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  background: rgba(255, 255, 255, 0.5);
  &,
  i {
    color: #333;
  }
`;

export default function SearchMapNoContent() {
  const { t } = useTranslation('search');
  return <Container icon="users" message={t('Zoom closer to find members.')} />;
}

SearchMapNoContent.propTypes = {};
