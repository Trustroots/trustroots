// External dependencies
import { useTranslation } from 'react-i18next';
import React, { useState, useEffect } from 'react';
import { useSearch } from '@tanstack/react-router';
import { Button } from '@trustroots/ui/Button';
import ContentState from '@/modules/core/client/components/ContentState';

// Internal dependencies
import { searchUsers } from '@/modules/users/client/api/search-users.api.js';
import UsersResults from './UsersResults';

const MINIMUM_QUERY_LENGTH = 3;

export default function SearchUsers() {
  const { t } = useTranslation('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [users, setUsers] = useState([]);
  const [searchFailed, setSearchFailed] = useState(false);

  async function fetchUsers(query: string) {
    setIsSearching(true);
    setHasSearched(true);
    setUsers([]);
    setSearchFailed(false);
    try {
      const { data: users } = await searchUsers(query);
      setUsers(users || []);
      setIsSearching(false);
    } catch {
      setSearchFailed(true);
    } finally {
      setIsSearching(false);
    }
  }

  const { search: urlSearchQuery } = useSearch({ strict: false });

  useEffect(() => {
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
          disabled={isSearching}
          className="form-control input-lg"
          onChange={({ target: { value } }) => {
            setHasSearched(false);
            setSearchFailed(false);
            setSearchQuery(value);
            setUsers([]);
          }}
          placeholder={t('Name, username, location or tagline…')}
          maxLength={120}
          tabIndex={0}
          type="text"
          value={searchQuery}
        />
        <span className="input-group-btn">
          <span>
            <Button
              aria-label={t('Clear members search')}
              size="lg"
              disabled={
                isSearching || searchQuery.length < MINIMUM_QUERY_LENGTH
              }
              onClick={() => {
                setSearchQuery('');
                setHasSearched(false);
                setSearchFailed(false);
                setUsers([]);
              }}
              type="button"
            >
              <i className="icon-close"></i>
            </Button>
          </span>
          <span>
            <Button
              aria-label={t('Search members')}
              size="lg"
              disabled={
                isSearching || searchQuery.length < MINIMUM_QUERY_LENGTH
              }
              type="submit"
            >
              <i className="icon-search"></i>
              <span className="hidden-xs">{String(t('Search'))}</span>
            </Button>
          </span>
        </span>
      </div>
    </form>
  );

  return (
    <section className="container container-spacer">
      {searchForm}
      {isSearching && (
        <ContentState
          kind="loading"
          heading={String(t('Searching members…'))}
          description={String(
            t('Please wait while we find members matching your search.'),
          )}
        />
      )}
      {searchFailed && (
        <ContentState
          kind="error"
          heading={String(t('Member search unavailable'))}
          description={String(
            t(
              'Could not search members. Please try again with a more specific search.',
            ),
          )}
          action={
            <Button type="button" onClick={() => fetchUsers(searchQuery)}>
              {String(t('Try again'))}
            </Button>
          }
        />
      )}
      {!isSearching && !searchFailed && hasSearched && (
        <UsersResults users={users} query={searchQuery} />
      )}
    </section>
  );
}
