// External dependencies
import React, { Component } from 'react';

// Internal dependencies
import { getUser } from '../api/users.api';
import AdminHeader from './AdminHeader.component.js';
import UserState from './UserState.component.js';

// Mongo ObjectId is always 24 chars long
const MONGO_OBJECT_ID_LENGTH = 24;

export default class AdminUser extends Component {
  constructor(props) {
    super(props);
    this.onIdChange = this.onIdChange.bind(this);
    this.queryUser = this.queryUser.bind(this);
    this.state = { id: '', user: false };
  }

  componentDidMount() {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');

    if (id && id.length === MONGO_OBJECT_ID_LENGTH) {
      this.setState({ id }, this.queryUser);
    }
  }

  onIdChange(event) {
    const id = event.target.value;
    this.setState({ id });

    // Update URL
    const url = new URL(document.location);
    url.searchParams.set('id', id);
    window.history.pushState(
      { id },
      window.document.title,
      url.toString()
    );
  }

  queryUser(event) {
    if (event) {
      event.preventDefault();
    }

    const { id } = this.state;

    this.setState({ user: false }, async () => {
      if (id.length === MONGO_OBJECT_ID_LENGTH) {
        const user = await getUser(id);
        this.setState({ user });
      }
    });
  }

  render() {
    const { user } = this.state;

    return (
      <>
        <AdminHeader />
        <div className="container">

          <h2>User report card</h2>

          <form onSubmit={ this.queryUser } className="form-inline">
            <label>
              User ID<br/>
              <input
                className="form-control input-lg"
                onChange={ this.onIdChange }
                size={ MONGO_OBJECT_ID_LENGTH + 2 }
                maxLength={ MONGO_OBJECT_ID_LENGTH }
                type="text"
                value={ this.state.id }
              />
            </label>
            <button
              className="btn btn-lg btn-default"
              disabled={ this.state.id.length !== MONGO_OBJECT_ID_LENGTH }
              type="submit"
            >
              Show
            </button>
          </form>

          { user && (
            <>
              <h3>{ user.displayName || user.username || user._id } report card</h3>
              <div className="panel panel-default">
                <div className="panel-body">
                  <UserState user={ user } />
                  <pre>{ JSON.stringify(user, null, 2) }</pre>
                </div>
              </div>
            </>
          ) }
        </div>
      </>
    );
  };
}

AdminUser.propTypes = {};
