// External dependencies
import { useTranslation } from 'react-i18next';
import React, { useState, useEffect } from 'react';

// Internal dependencies
import { searchUsers } from '@/modules/users/client/api/search-users.api.js';
import LoadingIndicator from '@/modules/core/client/components/LoadingIndicator';
import UsersResults from './UsersResults';

const MINIMUM_QUERY_LENGTH = 3;

export default function SearchUsers() {
  const { t } = useTranslation('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [users, setUsers] = useState([]);

  async function fetchUsers(query) {
    setIsSearching(true);
    setHasSearched(true);
    setUsers([]);
    try {
      const { data: users } = await searchUsers(query);
      setUsers(users || []);
      setIsSearching(false);
    } catch {
      // Do nothing
    } finally {
      setIsSearching(false);
    }
  }

  useEffect(() => {
    const urlSearchQuery = new URL(window.location).searchParams.get('search');

    if (urlSearchQuery) {
      setHasSearched(true);
      setSearchQuery(urlSearchQuery);
      if (urlSearchQuery.length >= MINIMUM_QUERY_LENGTH) {
        fetchUsers(urlSearchQuery);
      }
    }
  }, []);

  const searchForm = (
    <form
      className="form-group search-form-group"
      id="search-users-form"
      onSubmit={event => {
        event.preventDefault();
        fetchUsers(searchQuery);
      }}
    >
      <div className="input-group">
        <input
          aria-label={t('Search members')}
          className="form-control input-lg"
          onChange={({ target: { value } }) => {
            setHasSearched(false);
            setSearchQuery(value);
            setUsers([]);
          }}
          placeholder={t('Type name, username…')}
          tabIndex="0"
          type="text"
          value={searchQuery}
        />
        <span className="input-group-btn">
          <span>
            <button
              aria-label={t('Clear members search')}
              className="btn btn-lg btn-default"
              disabled={searchQuery.length < MINIMUM_QUERY_LENGTH}
              onClick={() => {
                setSearchQuery('');
                setHasSearched(false);
                setUsers([]);
              }}
              type="button"
            >
              <i className="icon-close"></i>
            </button>
          </span>
          <span>
            <button
              aria-label={t('Search members')}
              className="btn btn-lg btn-default"
              disabled={searchQuery.length < MINIMUM_QUERY_LENGTH}
              type="submit"
            >
              <i className="icon-search"></i>
              <span className="hidden-xs">{t('Search')}</span>
            </button>
          </span>
        </span>
      </div>
    </form>
  );

  return (
    <section className="container container-spacer">
      {searchForm}
      {isSearching && <LoadingIndicator />}
      {!isSearching && hasSearched && <UsersResults users={users} />}
    </section>
  );
}

SearchUsers.propTypes = {};
