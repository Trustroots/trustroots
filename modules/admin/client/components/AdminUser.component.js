// External dependencies
import { debounce } from 'lodash';
import React, { Component } from 'react';

// Internal dependencies
import { getUser } from '../api/search.api';
import AdminHeader from './AdminHeader.component.js';
import AdminUserPreview from './AdminUserPreview.component.js';

export default class AdminUser extends Component {
  constructor(props) {
    super(props);
    this.onIdChange = debounce(this.onIdChange.bind(this), 500);
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
              onChange={ () => this.onIdChange(event) }
              type="search"
            />
          </label>

          { user && <AdminUserPreview user={ user } /> }
        </div>
      </>
    );
  };
}

AdminUser.propTypes = {};
