import React from 'react';
import PropTypes from 'prop-types';

import UsersList from './UsersList';

import { searchUsers } from './search.api';

function UsersResults({ users, resolved }) {
  const userList = (
    <div className="contacts-list" ng-if="ContactsList.contacts.$resolved && ContactsList.contacts.length > 0">

      <div className="row">
        <div className="col-xs-12" ng-class="{'col-sm-8': ContactsList.contacts.length >= 6, 'text-center': ContactsList.contacts.length < 6}">
          <h4 className="text-muted">

            {users.length === 1 &&
            <span>
            One user found.
            </span>
            }

            {users.length > 1 &&
            <span>
              {users.length} users found.
              {/* {{ (ContactsList.contacts | filter:{ confirmed: true }).length }} contacts */}
            </span>
            }

            <UsersList users={users}/>

          </h4>
        </div>
      </div>
    </div>
  );

  const noUsers = (
    <div className="row content-empty" ng-if="ContactsList.contacts.$resolved && !ContactsList.contacts.length">
      <i className="icon-3x icon-users"></i>
      <h4>No users found with this name.</h4>
    </div>
  );

  return (
    <div>
      {!resolved?
        <div className="content-wait"
          role="alertdialog"
          aria-busy="true"
          aria-live="assertive"
          ng-if="!ContactsList.contacts || !ContactsList.contacts.$resolved">
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
  resolved: PropTypes.bool
};

// export class SearchUsersBar extends React.Component {

// export default function SearchUsers({ searchQuery }) {
class SearchUsers extends React.Component {

  constructor(props) {
    super(props);
    console.log('SearchUsers constructor');
    this.handleChange = this.handleChange.bind(this);
    this.actionSearch = this.actionSearch.bind(this);

    this.state = {
      searchQuery: props.searchQuery || '',
      resolved: true
    };
  }

  handleChange(event) {
    this.setState({ searchQuery: event.target.value });
    // this.props.searchQuery = event.target.value ;
  }

  async actionSearch(event) {
    event.preventDefault();
    event.stopPropagation();
    this.setState({ resolved: false });
    console.log('Searching for: ' + this.state.searchQuery);

    const userResults = await searchUsers(this.state.searchQuery);
    this.setState({ resolved: true, users: userResults });
    console.log(this.state.users);
  };

  clickClear() {
    this.setState({ searchQuery: '' });
  }

  render() {
    console.log('SearchUsers: render');

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
        <UsersResults users={this.state.users} resolved={this.state.resolved} />
        }
      </section>
    );
  }
}

SearchUsers.propTypes = {
  searchQuery: PropTypes.string
};


export default SearchUsers;
