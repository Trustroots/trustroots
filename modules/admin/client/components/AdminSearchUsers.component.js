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
      <style>
        {`#wrapper {
          margin-top: 60px;
        }`}
      </style>
      <div className="container" id="wrapper">

        <h2>Trustroots admin search users</h2>

        <p>Search users without regexp</p>

        <input type="text" onChange={this.searchUserQuery} />

        <div id="search-users-results">
          <ul>
            {this.state.userResults.map((user) =>
              <li key={user.username}><a href={'/profile/' + user.username}>
                { user.username }</a> {user.displayName}</li>)}
          </ul>
          { // {JSON.stringify(this.state.userResults)}
          }
        </div>
      </div>
    </>
  );};
}



AdminSearchUsers.propTypes = {};
