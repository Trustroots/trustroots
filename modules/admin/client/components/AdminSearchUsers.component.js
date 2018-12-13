import React from 'react';
import { searchUsers } from './search.api';

export default class AdminSearchUsers extends React.Component {

  constructor(props) {
    super(props);
    // FYI, this is magic
    this.searchUserQuery = this.searchUserQuery.bind(this);
    this.state = { userResults: [] };
  }

  async searchUserQuery(event) {
    const query = event.target.value;
    const userResults = await searchUsers(query);
    if (query.length > 5) {
      this.setState(() => ({ userResults }));
    }
  }

  render() { return (
    <>
      <div className="container container-spacer">

        <a href="/admin">/admin</a>

        <h2>Trustroots admin search users</h2>

        <p>Search users without regexp</p>

        <input type="search" onChange={this.searchUserQuery} />

        <div id="search-users-results">
          <table className="table">
            <tr><th>username</th><th>name</th><th>email</th><th>id</th></tr>
            {this.state.userResults.map((user) =>
              <tr key={user.username}><td><a href={'/profile/' + user.username}>{ user.username }</a></td> <td>{user.displayName}</td> <td>{user.email}</td> <td>{user._id}</td></tr>)}
          </table>

        </div>
      </div>
    </>
  );};
}



AdminSearchUsers.propTypes = {};
