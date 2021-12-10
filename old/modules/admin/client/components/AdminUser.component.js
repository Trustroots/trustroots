// External dependencies
import get from 'lodash/get';
import React, { Component } from 'react';

// Internal dependencies
import { getUser, setUserRole } from '../api/users.api';
import AdminHeader from './AdminHeader.component';
import AdminNotes from './AdminNotes';
import Json from './Json.component';
import UserEmailConfirmLink from './UserEmailConfirmLink.component';
import UserState from './UserState.component';

// Mongo ObjectId is always 24 chars long
const MONGO_OBJECT_ID_LENGTH = 24;

export default class AdminUser extends Component {
  constructor(props) {
    super(props);
    this.getUserById = this.getUserById.bind(this);
    this.handleUserRoleChange = this.handleUserRoleChange.bind(this);
    this.onIdChange = this.onIdChange.bind(this);
    this.queryUser = this.queryUser.bind(this);
    this.state = { id: '', user: false, isSettingUserRole: false };
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
    window.history.pushState({ id }, window.document.title, url.toString());
  }

  handleUserRoleChange(role) {
    const id = get(this, ['state', 'user', 'profile', '_id']);
    if (id) {
      const username = get(this, ['state', 'user', 'profile', 'username']);
      if (window.confirm(`Set ${username} role to ${role}?`)) {
        this.setState({ isSettingUserRole: true }, async () => {
          await setUserRole(id, role);
          // Get fresh user profile
          this.getUserById(id);
          this.setState({ isSettingUserRole: false });
        });
      }
    }
  }

  queryUser(event) {
    if (event) {
      event.preventDefault();
    }
    const { id } = this.state;
    this.getUserById(id);
  }

  getUserById(id) {
    this.setState({ user: false }, async () => {
      if (id.length === MONGO_OBJECT_ID_LENGTH) {
        const user = await getUser(id);
        this.setState({ user });
      }
    });
  }

  hasRole(role) {
    return get(this.state.user, ['profile', 'roles'], []).includes(role);
  }

  render() {
    const { user, isSettingUserRole } = this.state;
    const isProfile = user && user.profile;

    return (
      <>
        <AdminHeader />
        <div className="container">
          <h2>Member report card</h2>

          <form onSubmit={this.queryUser} className="form-inline">
            <label>
              Member ID
              <br />
              <input
                className="form-control input-lg"
                onChange={this.onIdChange}
                size={MONGO_OBJECT_ID_LENGTH + 2}
                maxLength={MONGO_OBJECT_ID_LENGTH}
                type="text"
                value={this.state.id}
              />
            </label>
            <button
              className="btn btn-lg btn-default"
              disabled={this.state.id.length !== MONGO_OBJECT_ID_LENGTH}
              type="submit"
            >
              Show
            </button>
          </form>

          {isProfile && (
            <>
              <h3 className="pull-left">
                <strong>
                  {user.profile.displayName ||
                    user.profile.username ||
                    user.profile._id}
                </strong>{' '}
                report card
              </h3>

              <div className="btn-group">
                {[
                  {
                    role: 'suspended',
                    color: 'danger',
                    label: 'Suspend',
                  },
                  {
                    role: 'shadowban',
                    color: 'danger',
                    label: 'Shadow ban',
                  },
                  {
                    role: 'moderator',
                    color: 'success',
                    label: 'Make moderator',
                  },
                  {
                    role: 'volunteer',
                    color: 'success',
                    label: 'Make volunteer',
                  },
                  {
                    role: 'volunteer-alumni',
                    color: 'success',
                    label: 'Make volunteer alumni',
                  },
                ].map(({ role, color, label }) => (
                  <button
                    key={role}
                    className={`btn btn-${color}`}
                    disabled={
                      user.profile.roles.includes(role) || isSettingUserRole
                    }
                    onClick={() => this.handleUserRoleChange(role)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <h4 id="stats">
                Stats
                <a href="#stats" className="btn btn-link">
                  #
                </a>
              </h4>
              <div className="panel panel-default admin-user">
                <div className="panel-body">
                  <UserState user={user.profile} />
                  <ul className="list-inline">
                    <li>
                      <strong>Messages</strong>
                    </li>
                    <li>{user.messageFromCount || 0} sent</li>
                    <li>{user.messageToCount || 0} received</li>
                    <li>
                      <a href={`/admin/threads?userId=${user.profile._id}`}>
                        {user.threadCount || 0} threads total
                      </a>
                    </li>
                  </ul>
                  <ul className="list-inline">
                    <li>
                      <strong>Thread votes received</strong>
                    </li>
                    <li className="text-success">
                      {user.threadReferencesReceivedYes} positive
                    </li>
                    <li className="text-danger">
                      {user.threadReferencesReceivedNo} negative
                    </li>
                  </ul>
                  <ul className="list-inline">
                    <li>
                      <strong>Thread votes gave</strong>
                    </li>
                    <li className="text-success">
                      {user.threadReferencesSentYes} positive
                    </li>
                    <li className="text-danger">
                      {user.threadReferencesSentNo} negative
                    </li>
                  </ul>
                  <p>
                    <strong>{user.contacts.length} contact(s)</strong>
                  </p>
                  <p>
                    <strong>
                      {user.offers.length} hosting or meet offer(s)
                    </strong>
                  </p>
                  <UserEmailConfirmLink user={user.profile} />
                </div>
              </div>

              <AdminNotes id={this.state.id} />

              <h4 id="profile">
                Profile
                <a href="#profile" className="btn btn-link">
                  #
                </a>
              </h4>
              <div className="panel panel-default">
                <div className="panel-body">
                  <Json content={user.profile} />
                </div>
              </div>
            </>
          )}

          {user && (
            <>
              <h4 id="offers">
                Hosting & meeting offers
                <a href="#offers" className="btn btn-link">
                  #
                </a>
              </h4>
              <div className="panel panel-default">
                <div className="panel-body">
                  {user.offers.length ? (
                    user.offers.map(offer => (
                      <div key={offer._id}>
                        <Json content={offer} />
                        <a
                          href={`/search?offer=${offer._id}`}
                          className="btn btn-sm btn-default"
                        >
                          Show offer on map
                        </a>
                        <a
                          href={`/search?location=${offer.location[1]},${offer.location[0]}`}
                          className="btn btn-sm btn-default"
                        >
                          Show location on map
                        </a>
                        <hr className="hr-gray" />
                      </div>
                    ))
                  ) : (
                    <p>
                      <em>{"Member doesn't have any saved offers."}</em>
                    </p>
                  )}
                </div>
              </div>

              <h4 id="contacts">
                Contacts
                <a href="#contacts" className="btn btn-link">
                  #
                </a>
              </h4>
              <div className="panel panel-default">
                <div className="panel-body">
                  {user.contacts.length ? (
                    user.contacts.map(contact => (
                      <Json content={contact} key={contact._id} />
                    ))
                  ) : (
                    <p>
                      <em>{"Member doesn't have any contacts."}</em>
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </>
    );
  }
}

AdminUser.propTypes = {};
