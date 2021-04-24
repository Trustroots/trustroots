/**
 * A link to beport member
 * @param {string} username - the username of the user to report
 */

import React from 'react';
import PropTypes from 'prop-types';
import '@/config/client/i18n';
import { useTranslation } from 'react-i18next';

import * as api from '../api/block.api';

export default function BlockMemberLink({ username }) {
  const { t } = useTranslation('support');

  async function handleBlockMember({ username }) {
    alert(username);
    await api.block(username);
  }

  return (
    <a
      href={`/support?block=${username}`}
      className="small text-muted"
      onClick={() => handleBlockMember({ username })}
      aria-label={t('Block member {{username}} to support', { username })}
    >
      {t('Block member')}
    </a>
  );
}

BlockMemberLink.propTypes = {
  username: PropTypes.string.isRequired,
};
