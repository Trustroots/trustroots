// External dependencies
import React, { Component } from 'react';

// Internal dependencies
import { getUser } from '../api/users.api';
import AdminHeader from './AdminHeader.component.js';
import UserState from './UserState.component.js';

export default class AdminUser extends Component {
  constructor(props) {
    super(props);
    this.onIdChange = this.onIdChange.bind(this);
    this.state = { user: false };
  }

  componentDidMount() {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');

    // Mongoose ObjectId is always 24 chars long
    if (id && id.length === 24) {
      this.queryUser(id);
    }
  }

  onIdChange(event) {
    const { value } = event.target;
    this.setState({ user: false }, () => {
      this.queryUser(value);
    });
  }

  async queryUser(id='') {
    // Mongoose ObjectId is always 24 chars long
    if (id.length === 24) {
      const user = await getUser(id);
      this.setState(() => ({ user }));
    }
  }

  render() {
    const { user } = this.state;

    return (
      <>
        <AdminHeader />
        <div className="container">

          <h2>Show user</h2>

          <label>
            User ID<br/>
            <input
              className="form-control input-lg"
              onChange={ this.onIdChange }
              type="search"
            />
          </label>

          { user && (
            <div className="panel panel-default">
              <div className="panel-body">
                <UserState user={ user } />
                <pre>{ JSON.stringify(user, null, 2) }</pre>
              </div>
            </div>
          ) }
        </div>
      </>
    );
  };
}

AdminUser.propTypes = {};
