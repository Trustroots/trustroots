import React from 'react';
import PropTypes from 'prop-types';

import UsersList from './UsersList';

import { searchUsers } from '@/modules/users/client/api/search-users.api.js';

function UsersResults({ users, isSearching }) {
  const userList = (
    <div className="contacts-list">

      <div className="row">
        <div className="col-xs-12">
          <h4 className="text-muted">

            {users.length === 1 &&
            <span>
            One user found.
            </span>
            }

            {users.length > 1 &&
            <span>
              {users.length} users found.
            </span>
            }

            <UsersList users={users}/>

          </h4>
        </div>
      </div>
    </div>
  );

  const noUsers = (
    <div className="row content-empty">
      <i className="icon-3x icon-users"></i>
      <h4>No users found with this name.</h4>
    </div>
  );

  return (
    <div>
      {!isSearching?
        <div className="content-wait"
          role="alertdialog"
          aria-busy="true"
          aria-live="assertive">
          <small>Wait a moment...</small>
        </div>
        :
        (users && users.length > 0? userList : noUsers)
      }
    </div>
  );
}

UsersResults.propTypes = {
  users: PropTypes.array,
  isSearching: PropTypes.bool
};

class SearchUsers extends React.Component {

  constructor(props) {
    super(props);
    this.handleChange = this.handleChange.bind(this);
    this.actionSearch = this.actionSearch.bind(this);

    this.state = {
      searchQuery: props.searchQuery || '',
      isSearching: true
    };
  }

  handleChange(event) {
    this.setState({ searchQuery: event.target.value });
    // this.props.searchQuery = event.target.value ;
  }

  async actionSearch(event) {
    event.preventDefault();
    event.stopPropagation();
    this.setState({ isSearching: false });

    this.setState({ isSearching: false }, async () => {
      searchUsers(this.state.searchQuery)
        .then(({ data }) => {
          this.setState({ isSearching: true, users: data });
        });
    });

  };

  clickClear() {
    this.setState({ searchQuery: '' });
  }

  render() {

    const borderStyle = { 'borderLeftWidth': '1px',
      'borderLeftStyle': 'solid',
      'borderColor': '#eee' };

    const switchToSearchPlaces = (
      <span className="input-group-btn"
        style={borderStyle}>
        <a type="button"
          href="/search"
          className="btn btn-lg btn-default"
          tooltip-enable="::search.screenWidth >= 768"
          tooltip-placement="bottom"
          aria-label="Go to map search">
          <i className="icon-map"></i>
        </a>
      </span>
    );

    const searchForm = (
      <form className="form-group search-form-group" id="search-users-form"
        onSubmit={this.actionSearch}>
        <div className="input-group">
          {switchToSearchPlaces}
          <label htmlFor="search-query" className="sr-only">Search users</label>
          <input type="text"
            id="search-query"
            className="form-control input-lg"
            placeholder="Search users"
            tabIndex="0"
            onChange={ this.handleChange }
            value={this.state.searchQuery} />
          <span className="input-group-btn">
            <span>
              <button type="button"
                disabled={!this.state.searchQuery}
                onClick={this.clickClear.bind(this)}
                className="btn btn-lg btn-default"
                tooltip-enable="::search.screenWidth >= 768"
                tooltip-placement="bottom"
                aria-label="Clear users search">
                <i className="icon-close"></i>
              </button>
            </span>
            <span>
              <button type="submit"
                disabled={!this.state.searchQuery}
                className="btn btn-lg btn-default"
                tooltip-enable="::search.screenWidth >= 768"
                tooltip-placement="bottom"
                aria-label="Search users">
                <i className="icon-search"></i>
              </button>
            </span>
          </span>
        </div>
      </form>);

    return (
      <section className="container container-spacer">
        {searchForm}
        { this.state.users &&
        <UsersResults users={this.state.users} isSearching={this.state.isSearching} />
        }
      </section>
    );
  }
}

SearchUsers.propTypes = {
  searchQuery: PropTypes.string
};


export default SearchUsers;
