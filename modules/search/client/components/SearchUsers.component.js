import React from 'react';
import UsersResults from './UsersResults';
import LoadingIndicator from '@/modules/core/client/components/LoadingIndicator';

import { searchUsers } from '@/modules/users/client/api/search-users.api.js';

const MINIMUM_QUERY_LENGTH = 3;

class SearchUsers extends React.Component {
  constructor(props) {
    super(props);
    this.handleChange = this.handleChange.bind(this);
    this.actionSearch = this.actionSearch.bind(this);
    this.clearSearchQuery = this.clearSearchQuery.bind(this);

    this.state = {
      searchQuery: '',
      isSearching: false,
    };
  }

  handleChange(event) {
    this.setState({ searchQuery: event.target.value });
  }

  actionSearch(event) {
    event.preventDefault();
    event.stopPropagation();

    this.setState({ isSearching: true }, () => {
      searchUsers(this.state.searchQuery).then(({ data }) => {
        this.setState({ users: data, isSearching: false });
      }).catch(() => {
        this.setState({ isSearching: false });
      });
    });
  }

  clearSearchQuery() {
    this.setState({ searchQuery: '' });
  }

  render() {
    const searchForm = (
      <form
        className="form-group search-form-group"
        id="search-users-form"
        onSubmit={this.actionSearch}
      >
        <div className="input-group">
          <input
            aria-label="Search members"
            className="form-control input-lg"
            onChange={this.handleChange}
            placeholder="Type name, username..."
            tabIndex="0"
            type="text"
            value={this.state.searchQuery}
          />
          <span className="input-group-btn">
            <span>
              <button
                aria-label="Clear members search"
                className="btn btn-lg btn-default"
                disabled={this.state.searchQuery.length < MINIMUM_QUERY_LENGTH}
                onClick={this.clearSearchQuery}
                type="button"
              >
                <i className="icon-close"></i>
              </button>
            </span>
            <span>
              <button
                aria-label="Search members"
                className="btn btn-lg btn-default"
                disabled={this.state.searchQuery.length < MINIMUM_QUERY_LENGTH}
                type="submit"
              >
                <i className="icon-search"></i>
              </button>
            </span>
          </span>
        </div>
      </form>
    );

    return (
      <section className="container container-spacer">
        {searchForm}
        {this.state.isSearching && <LoadingIndicator />}
        {!this.state.isSearching && this.state.users &&
          <UsersResults users={this.state.users} />
        }
      </section>
    );
  }
}

SearchUsers.propTypes = {};

export default SearchUsers;
