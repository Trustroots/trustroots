import React from 'react';
import PropTypes from 'prop-types';

import UsersList from './UsersList';

class SearchUsersBar extends React.Component {

  constructor(props) {
    super(props);
    console.log('SearchUsersBar constructor');
    console.log(props);
    this.state = {
      searchQuery: props.searchQuery
    };
  }

  clickClear() {
    this.setState({ searchQuery: '' });
  }

  handleChange(event) {
    this.setState({ searchQuery: event.target.value });
    this.props.onInputChange(event);
    // this.props.searchQuery = event.target.value ;
  }

  // clickSearch() {
  // this.props.actionSearch()
  // console.log('Searching for: ' + this.state.searchQuery);
  // }

  render() {
    console.log('render');
    console.log(this.props);
    const switchToSearchPlaces = (
      <a type="button"
        href="/search"
        className="btn btn-lg btn-default"
        tooltip-enable="::search.screenWidth >= 768"
        tooltip-placement="bottom"
        aria-label="Go to map search">
        <i className="icon-tree"></i>
      </a>
    );

    const searchForm = (
      <div className="form-group search-form-group" id="search-users-form">
        <div className="input-group">
          <label htmlFor="search-query" className="sr-only">Search users</label>
          <input type="text"
            id="search-query"
            className="form-control input-lg"
            placeholder="Search users"
            tabIndex="0"
            onChange={ this.handleChange.bind(this) }
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
              <button type="button"
                disabled={!this.state.searchQuery}
                onClick={() => this.props.actionSearch()}
                className="btn btn-lg btn-default"
                tooltip-enable="::search.screenWidth >= 768"
                tooltip-placement="bottom"
                aria-label="Search users">
                <i className="icon-search"></i>
              </button>
            </span>
          </span>
        </div>
      </div>
    );

    return (
      <span>
        {switchToSearchPlaces}
        {searchForm}
      </span>
    );
  }
}

SearchUsersBar.defaultProps = {
  searchQuery: ''
};

SearchUsersBar.propTypes = {
  searchQuery: PropTypes.string,
  onInputChange: PropTypes.function,
  actionSearch: PropTypes.function
};


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
      {(!users || !resolved) &&
      <div className="content-wait"
        role="alertdialog"
        aria-busy="true"
        aria-live="assertive"
        ng-if="!ContactsList.contacts || !ContactsList.contacts.$resolved">
        <small>Wait a moment...</small>
      </div>}
      {resolved && (users && users.length > 0? userList : noUsers)}
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
      searchQuery: props.searchQuery,
      resolved: true
    };
  }

  handleChange(event) {
    this.setState({ searchQuery: event.target.value });
    // this.props.searchQuery = event.target.value ;
  }

  actionSearch() {
    /*eslint-disable */
    // this.setState({ searchQuery: searchQuery });
    this.setState({ resolved: false });
    console.log('Searching for: ' + this.state.searchQuery);
    // do AJAX call too API: /users/?search=
    setTimeout(() => {
      this.setState({ resolved: true })
      console.log('result!')}
      , 2000);

    /* eslint-enable */
  };

  clickClear() {
    this.setState({ searchQuery: '' });
  }

  render() {
    console.log('SearchUsers: render');
    const users = [{ displayName: 'Abel Por Que No', avatarSource: '/test.html', profileUrl: '/profile/admin1' },
      { displayName: 'Abel Por Que Sí', avatarSource: '/test.html', profileUrl: '/profile/admin1' }
    ];

    const switchToSearchPlaces = (
      <span className="input-group-btn">
        <a type="button"
          href="/search"
          className="btn btn-lg btn-default"
          tooltip-enable="::search.screenWidth >= 768"
          tooltip-placement="bottom"
          aria-label="Go to map search">
          <i className="icon-tree"></i>
        </a>
      </span>
    );

    const searchForm = (
      <div className="form-group search-form-group" id="search-users-form">
        <div className="input-group">
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
                onClick={() => this.actionSearch()}
                className="btn btn-lg btn-default"
                tooltip-enable="::search.screenWidth >= 768"
                tooltip-placement="bottom"
                aria-label="Search users">
                <i className="icon-search"></i>
              </button>
            </span>
          </span>
        </div>
      </div>);

    return (
      <section className="container container-spacer">
        {switchToSearchPlaces}
        {searchForm}
        <UsersResults users={users} resolved={this.state.resolved} />
      </section>
    );
  }
}

SearchUsers.propTypes = {
  searchQuery: PropTypes.string
};

SearchUsers.defaultProps = {
  searchQuery: ''
};

export default SearchUsers;
