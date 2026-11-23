import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@trustroots/ui/Button';
import { Input } from '@trustroots/ui/Input';

import ContentState from '@/modules/core/client/components/ContentState';
import {
  searchUsers,
  type MemberSearchFilters,
} from '@/modules/users/client/api/search-users.api';
import type { UserProfile } from '@/modules/users/client/types';
import SearchCirclesToggle from './SearchCirclesToggle.component';
import SearchFilterLanguage from './SearchFilterLanguage.component';
import SearchFilterSwitch from './SearchFilterSwitch.component';
import UsersResults from './UsersResults';

const MINIMUM_QUERY_LENGTH = 3;

function readList(param: unknown) {
  return typeof param === 'string' && param ? param.split(',') : [];
}

function isEnabled(param: unknown) {
  return param === true || param === 'true';
}

export default function SearchUsers() {
  const { t } = useTranslation('search');
  const params = useSearch({ strict: false });
  const navigate = useNavigate();
  const submittedQuery =
    typeof params.search === 'string' ||
    typeof params.search === 'number' ||
    typeof params.search === 'boolean'
      ? String(params.search).trim()
      : '';
  const [draft, setDraft] = useState({
    submitted: submittedQuery,
    value: submittedQuery,
  });

  if (draft.submitted !== submittedQuery) {
    setDraft({ submitted: submittedQuery, value: submittedQuery });
  }

  const types = readList(params.types).filter(
    type => type === 'host' || type === 'meet',
  );
  const filters = {
    connectionsOnly: isEnabled(params.connectionsOnly),
    types,
    volunteering: isEnabled(params.volunteering),
    onlineRecently: isEnabled(params.onlineRecently),
    tribes: readList(params.tribes),
    languages: readList(params.languages),
  } satisfies MemberSearchFilters;

  const hasValidQuery = submittedQuery.length >= MINIMUM_QUERY_LENGTH;
  const results = useQuery({
    queryKey: ['member-search', submittedQuery, filters],
    queryFn: async (): Promise<UserProfile[]> => {
      const { data } = await searchUsers(submittedQuery, filters);
      return data ?? [];
    },
    enabled: hasValidQuery,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const matchesSubmittedQuery = draft.value.trim() === submittedQuery;
  const isSearching = matchesSubmittedQuery && results.isFetching;
  const searchFailed = matchesSubmittedQuery && results.isError;
  const canSubmit =
    !isSearching && draft.value.trim().length >= MINIMUM_QUERY_LENGTH;

  function writeSearchParams(
    update: Record<string, string | boolean | undefined>,
  ) {
    void navigate({
      to: '/search/members',
      hash: true,
      search: (previous: Record<string, unknown>) => ({
        ...previous,
        ...update,
      }),
    });
  }

  function updateType(type: 'host' | 'meet', checked: boolean) {
    const next = checked
      ? [...types, type]
      : types.filter(selected => selected !== type);
    writeSearchParams({ types: next.join(',') || undefined });
  }

  return (
    <section className="tw:page-container container-spacer">
      <form
        className="form-group search-form-group"
        id="search-users-form"
        onSubmit={event => {
          event.preventDefault();
          if (!canSubmit) return;

          if (matchesSubmittedQuery) {
            void results.refetch();
          } else {
            writeSearchParams({ search: draft.value.trim() });
          }
        }}
      >
        <div data-slot="input-group" className="tw:input-group">
          <Input
            aria-label={t('Search members')}
            disabled={isSearching}
            fieldSize="lg"
            onChange={({ target: { value } }) =>
              setDraft({ submitted: submittedQuery, value })
            }
            placeholder={t('Name, username, location or tagline…')}
            maxLength={120}
            tabIndex={0}
            type="text"
            value={draft.value}
          />
          <span className="input-group-btn">
            <span>
              <Button
                aria-label={t('Clear members search')}
                size="lg"
                disabled={!canSubmit}
                onClick={() => {
                  setDraft({ submitted: submittedQuery, value: '' });
                  writeSearchParams({ search: undefined });
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
                disabled={!canSubmit}
                type="submit"
              >
                <i className="icon-search"></i>
                <span className="tw:max-sm:hidden">{String(t('Search'))}</span>
              </Button>
            </span>
          </span>
        </div>
        <fieldset aria-label={t('Member filters')} className="tw:mt-4">
          <div className="tw:grid tw:gap-x-4 tw:gap-y-2 tw:min-[440px]:grid-cols-2 tw:md:grid-cols-3">
            <SearchFilterSwitch
              checked={types.includes('host')}
              onChange={checked => updateType('host', checked)}
            >
              {t('Hosts')}
            </SearchFilterSwitch>
            <SearchFilterSwitch
              checked={types.includes('meet')}
              onChange={checked => updateType('meet', checked)}
            >
              {t('Meetings')}
            </SearchFilterSwitch>
            <SearchFilterSwitch
              checked={filters.volunteering}
              onChange={checked =>
                writeSearchParams({ volunteering: checked || undefined })
              }
            >
              {t('Offers volunteering')}
            </SearchFilterSwitch>
            <SearchFilterSwitch
              checked={filters.connectionsOnly}
              onChange={checked =>
                writeSearchParams({ connectionsOnly: checked || undefined })
              }
            >
              {t('My connections only')}
            </SearchFilterSwitch>
            <SearchFilterSwitch
              checked={filters.onlineRecently}
              onChange={checked =>
                writeSearchParams({ onlineRecently: checked || undefined })
              }
            >
              {t('Online in the past 6 months')}
            </SearchFilterSwitch>
          </div>
          <details className="tw:mt-4">
            <summary className="tw:cursor-pointer">
              {t('Circles and languages')}
              {filters.tribes.length + filters.languages.length > 0 && (
                <> ({filters.tribes.length + filters.languages.length})</>
              )}
            </summary>
            <div className="tw:mt-4">
              <h4>{t('Circles')}</h4>
              <SearchCirclesToggle
                selectedTribeIds={filters.tribes}
                onChange={tribes =>
                  writeSearchParams({ tribes: tribes.join(',') || undefined })
                }
              />
              <SearchFilterLanguage
                preSelectedLanguages={filters.languages}
                onChangeLanguages={languages =>
                  writeSearchParams({
                    languages: languages.join(',') || undefined,
                  })
                }
              />
            </div>
          </details>
        </fieldset>
      </form>
      {isSearching && (
        <ContentState
          kind="loading"
          heading={String(t('Searching members…'))}
          description={String(
            t('Please wait while we find members matching your search.'),
          )}
        />
      )}
      {!isSearching && searchFailed && (
        <ContentState
          kind="error"
          heading={String(t('Member search unavailable'))}
          description={String(
            t(
              'Could not search members. Please try again with a more specific search.',
            ),
          )}
          action={
            <Button type="button" onClick={() => void results.refetch()}>
              {String(t('Try again'))}
            </Button>
          }
        />
      )}
      {!isSearching &&
        !searchFailed &&
        matchesSubmittedQuery &&
        submittedQuery && (
          <UsersResults users={results.data ?? []} query={submittedQuery} />
        )}
    </section>
  );
}
