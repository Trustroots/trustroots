// External dependencies
import { debounce } from 'lodash';
import classnames from 'classnames';
import React, { Component } from 'react';

// Internal dependencies
import { searchUsers, getUser } from '../api/search.api';
import AdminHeader from './AdminHeader.component.js';
import AdminUserPreview from './AdminUserPreview.component.js';
import ZendeskInboxSearch from './ZendeskInboxSearch.component.js';

// Maximum limit API will return
const limit = 50;

export function showUserRoles(roles) {
  return roles
    .filter((role) => role !== 'user')
    .map((role) => (
      <span className="label label-default admin-user-role" key={ role }>
        { role }
      </span>
    ));
}

export default class AdminSearchUsers extends Component {
  constructor(props) {
    super(props);
    this.onSearchChange = debounce(this.onSearchChange.bind(this), 500);
    this.showUser = this.showUser.bind(this);
    this.state = {
      userResults: [],
      user: false
    };
  }

  async componentDidMount() {
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('query');

    if (query) {
      this.doSearchQuery(query);
    }
  }

  async showUser(id) {
    const user = await getUser(id);
    this.setState(() => ({ user }));
  }

  onSearchChange(event) {
    const { value } = event.target;
    this.doSearchQuery(value);
  }

  async doSearchQuery(query='') {
    if (query.length >= 3) {
      const userResults = await searchUsers(query);
      this.setState(() => ({ userResults }));
    }
  }

  render() {
    const { userResults, user } = this.state;

    return (
      <>
        <AdminHeader />
        <div className="container">
          <h2 className="font-brand-light">Search users</h2>

          { user && (
              <>
                <h3>{ user.username }</h3>
                <button
                  aria-label="Close"
                  className="btn btn-lg pull-right"
                  onClick={ () => this.setState({ user: false }) }
                >
                  <span aria-hidden="true">&times;</span>
                </button>
                <AdminUserPreview user={ user } />
              </>
          ) }

          <label>
            Name, username or email<br/>
            <input
              className="form-control input-lg"
              onChange={ () => this.onSearchChange(event) }
              type="search"
            />
          </label>

          { userResults.length ? (
            <div className="panel panel-default">
              <div className="panel-body">
                <table className="table table-striped">
                  <thead>
                    <tr>
                      <th>Username</th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Public</th>
                      <th>ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {
                      userResults.map((user) => {
                        const { _id, displayName, email, roles, username } = user;
                        return (
                          <tr
                            className={ classnames({ 'bg-danger': roles.includes('suspended') }) }
                            key={_id}
                          >
                            <td>
                              <a href={'/profile/' + username} title="Profile on Trustroots">{ username }</a>
                              { showUserRoles(roles) }
                              <button
                                className="btn btn-link btn-sm admin-hidden-until-hover"
                                onClick={ () => this.showUser(_id) }
                              >
                                Show
                              </button>
                              <ZendeskInboxSearch className="admin-hidden-until-hover" q={ username } />
                            </td>
                            <td>
                              { displayName }
                              <ZendeskInboxSearch className="admin-hidden-until-hover" q={ displayName } />
                            </td>
                            <td>
                              { email }
                              <ZendeskInboxSearch className="admin-hidden-until-hover" q={ email } />
                            </td>
                            <td>{ user.public ? (<span title="Yep">✅</span>) : (<span title="Nope">🔴</span>) }</td>
                            <td><small><code style={ { 'userSelect': 'all' } }>{ _id }</code></small></td>
                          </tr>
                        );
                      })
                    }
                  </tbody>
                </table>
              </div>
              <div className="panel-footer">
                { userResults.length } user(s).
                { userResults.length === limit && <p className="text-warning">There might be more results but { limit } is maximum.</p>}
              </div>
            </div>
          ) : <p><br/><em className="text-muted">Search something...</em></p> }
        </div>
      </>
    );
  };
}

AdminSearchUsers.propTypes = {};
