// External dependencies
import { useNavigate, useSearch } from '@tanstack/react-router';
import React, { useEffect, useId, useState, type FormEvent } from 'react';
import { formatRoleLabel } from '../utils/role-label';

// Internal dependencies
import { searchUsers, listUsersByRole } from '../api/users.api';
import AdminHeader from './AdminHeader.component';
import AdminUserResultsTable from './AdminUserResultsTable.component';
import { SEARCH_STRING_LIMIT, normalizeAdminQuery } from './userSearch.helpers';
import { Button } from '@trustroots/ui/Button';
import { Input } from '@trustroots/ui/Input';
import { Select } from '@trustroots/ui/Select';

interface MemberSort {
  column: string;
  direction: 'ascending' | 'descending';
}

interface MemberRecord {
  _id: string;
  profile?: {
    _id: string;
    username?: string;
    displayName?: string;
    email?: string;
    created?: string | number;
    location?: { city?: string; country?: string };
    roles?: string[];
    public?: boolean;
  };
}

interface MemberList {
  users: MemberRecord[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  } | null;
  sort: MemberSort;
}

interface SearchUsersProps {
  showHeading?: boolean;
}

interface SearchUsersRouteProps extends SearchUsersProps {
  navigate: ReturnType<typeof useNavigate>;
  search: { role?: string; search?: string };
}

const DEFAULT_MEMBER_LIST_SORT: MemberSort = {
  column: 'username',
  direction: 'ascending',
};

const USER_LIST_ROLES = [
  'flagged',
  'admin',
  'welcome-team',
  'support-team',
  'shadowban',
  'suspended',
  'volunteer-alumni',
  'volunteer',
];

export function SearchUsersContent({
  showHeading = true,
  navigate,
  search: initialSearch,
}: SearchUsersRouteProps) {
  const id = useId();
  const [role, setRole] = useState('admin');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState(DEFAULT_MEMBER_LIST_SORT);
  const [results, setResults] = useState<
    (MemberList & { source: 'role' | 'search' }) | null
  >(null);
  const normalizedSearch = normalizeAdminQuery(query);

  useEffect(() => {
    const memberRole = initialSearch.role;
    if (memberRole && USER_LIST_ROLES.includes(memberRole)) {
      setRole(memberRole);
      void loadRole(null, { role: memberRole });
      return;
    }
    const queryFromUrl = normalizeAdminQuery(initialSearch.search);
    if (queryFromUrl) {
      setQuery(queryFromUrl);
      void loadSearch(null, { query: queryFromUrl });
    }
  }, []);

  function updateResults(memberList: MemberList, source: 'role' | 'search') {
    setSort(memberList.sort);
    setResults({ ...memberList, source });
  }

  function onPageChange(page: number) {
    return results?.source === 'role'
      ? loadRole(null, { page })
      : loadSearch(null, { page });
  }

  function onSortChange(requestedSort: MemberSort) {
    setSort(requestedSort);
    if (results?.source === 'role') {
      void loadRole(null, { page: 1, sort: requestedSort });
    } else {
      void loadSearch(null, { page: 1, sort: requestedSort });
    }
  }

  async function loadRole(
    event: FormEvent<HTMLFormElement> | null = null,
    options: { page?: number; sort?: MemberSort; role?: string } = {},
  ) {
    event?.preventDefault();
    const requestedRole = options.role ?? role;
    void navigate({
      hash: true,
      replace: Boolean(options.page || options.sort),
      search: (search: Record<string, string>) => ({
        ...search,
        role: requestedRole,
        search: undefined,
      }),
      to: '.',
    });
    const memberList: MemberList = await listUsersByRole(requestedRole, {
      page: options.page || 1,
      sort: options.sort || sort,
    });
    updateResults(memberList, 'role');
  }

  async function loadSearch(
    event: FormEvent<HTMLFormElement> | null = null,
    options: { page?: number; sort?: MemberSort; query?: string } = {},
  ) {
    event?.preventDefault();
    const search = normalizeAdminQuery(options.query ?? query);
    if (search !== query) {
      setQuery(search);
    }
    void navigate({
      hash: true,
      replace: Boolean(options.page || options.sort),
      search: (current: Record<string, string>) => ({
        ...current,
        role: undefined,
        search: search || undefined,
      }),
      to: '.',
    });
    if (search.length >= SEARCH_STRING_LIMIT) {
      const memberList: MemberList = await searchUsers(search, {
        page: options.page || 1,
        sort: options.sort || sort,
      });
      updateResults(memberList, 'search');
    }
  }

  return (
    <>
      {showHeading && <h2>Search members</h2>}

      <div className="row">
        <div className="col-xs-12 col-md-6">
          <form onSubmit={loadSearch} className="form-inline">
            <label htmlFor={id}>
              Name, username or email
              <br />
              <Input
                id={id}
                type="search"
                value={query}
                onChange={event => setQuery(event.target.value)}
              />
            </label>
            <Button
              disabled={normalizedSearch.length < SEARCH_STRING_LIMIT}
              type="submit"
            >
              Search
            </Button>
          </form>
        </div>
        <div className="col-xs-12 col-md-6">
          <form onSubmit={loadRole} className="form-inline pull-right">
            <Select
              name="role"
              aria-label="Role"
              onChange={event => setRole(event.target.value)}
              value={role}
            >
              {USER_LIST_ROLES.map(role => (
                <option value={role} key={role}>
                  {formatRoleLabel(role)}
                </option>
              ))}
            </Select>
            <Button type="submit">List users in role</Button>
          </form>
        </div>
      </div>

      <AdminUserResultsTable
        onPageChange={onPageChange}
        onSortChange={onSortChange}
        pagination={results?.pagination ?? null}
        showPublicProfileLink
        showUserState
        showZendeskActions
        sort={sort}
        userResults={results?.users ?? []}
      />
    </>
  );
}

export function AdminSearchUsersContent(props: SearchUsersProps) {
  const navigate = useNavigate();
  const search = useSearch({ strict: false });
  return <SearchUsersContent {...props} navigate={navigate} search={search} />;
}

export default function AdminSearchUsers() {
  return (
    <>
      <AdminHeader />
      <div className="container">
        <AdminSearchUsersContent />
      </div>
    </>
  );
}
