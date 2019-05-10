import React, { Component } from 'react';
import { searchUsers } from '../api/search.api';
import { AdminHeader } from './AdminHeader.component.js';

export default class AdminSearchUsers extends Component {

  constructor(props) {
    super(props);
    this.searchUserQuery = this.searchUserQuery.bind(this);
    this.state = { userResults: [] };
  }

  async searchUserQuery(event) {
    const query = event.target.value;
    const userResults = await searchUsers(query);
    if (query.length > 3) {
      this.setState(() => ({ userResults }));
    }
  }

  render() {
    return (
      <div className="container container-spacer">
        <AdminHeader />

        <h2>Search users</h2>

        <label>Name, username or email
          <input type="search" onChange={this.searchUserQuery} />
        </label>

        { this.state.userResults.length && (
          <div id="search-users-results">
            <table className="table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>ID</th>
                </tr>
              </thead>
              <tbody>
                {this.state.userResults.map(({ _id, displayName, email, username }) =>
                  <tr key={_id}>
                    <td><a href={'/profile/' + username}>{ username }</a></td>
                    <td>{displayName}</td>
                    <td>{email}</td>
                    <td><code>{_id}</code></td>
                  </tr>
                )}
              </tbody>
            </table>

          </div>
        )}
      </div>
    );
  };
}

AdminSearchUsers.propTypes = {};
