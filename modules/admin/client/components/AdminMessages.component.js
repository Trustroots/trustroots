// External dependencies
import React, { Component } from 'react';

// Internal dependencies
import { getMessages } from '../api/messages.api';
import AdminHeader from './AdminHeader.component';
import Json from './Json.component';
import UserLink from './UserLink.component';

// Mongo ObjectId is always 24 chars long
const MONGO_OBJECT_ID_LENGTH = 24;

export default class AdminMessages extends Component {
  constructor(props) {
    super(props);
    this.onUserChange = this.onUserChange.bind(this);
    this.onSubmit = this.onSubmit.bind(this);
    this.state = {
      messages: [],
      user1: '',
      user2: '',
    };
  }

  onUserChange(event) {
    const { name, value } = event.target;
    this.setState({
      [name]: value,
    });
  }

  async onSubmit(event) {
    if (event) {
      event.preventDefault();
    }
    const { user1, user2 } = this.state;
    if (
      user1 &&
      user2 &&
      user1.length === MONGO_OBJECT_ID_LENGTH &&
      user2.length === MONGO_OBJECT_ID_LENGTH
    ) {
      const messages = await getMessages(user1, user2);
      this.setState({ messages });
    }
  }

  render() {
    const { messages, user1, user2 } = this.state;

    return (
      <>
        <AdminHeader />
        <div className="container">
          <h2>Messages</h2>

          <form className="form-inline" onSubmit={this.onSubmit}>
            <input
              aria-label="Member 1 ID"
              className="form-control input-lg"
              maxLength={MONGO_OBJECT_ID_LENGTH}
              name="user1"
              onChange={this.onUserChange}
              placeholder="Member 1 ID"
              size={MONGO_OBJECT_ID_LENGTH + 2}
              type="text"
              value={user1}
            />
            <input
              aria-label="Member 2 ID"
              className="form-control input-lg"
              maxLength={MONGO_OBJECT_ID_LENGTH}
              name="user2"
              onChange={this.onUserChange}
              placeholder="Member 2 ID"
              size={MONGO_OBJECT_ID_LENGTH + 2}
              type="text"
              value={user2}
            />
            <button
              className="btn btn-lg btn-default"
              disabled={
                user1.length !== MONGO_OBJECT_ID_LENGTH &&
                user2.length !== MONGO_OBJECT_ID_LENGTH
              }
              type="submit"
            >
              Read
            </button>
          </form>

          {messages.length ? (
            <>
              <h3>
                Messaging between <UserLink user={messages[0].userFrom} />
                {' & '}
                <UserLink user={messages[0].userTo} />
              </h3>
              {messages.map(message => {
                const { _id } = message;
                return (
                  <div className="panel panel-default" key={_id}>
                    <div className="panel-body">
                      {message.content}
                      <br />
                      <br />
                      <UserLink user={message.userFrom} />
                      <details>
                        <summary>Message details</summary>
                        <Json content={message} />
                      </details>
                    </div>
                  </div>
                );
              })}
            </>
          ) : (
            <p>
              <br />
              <em className="text-muted">Choose two members…</em>
            </p>
          )}
        </div>
      </>
    );
  }
}

AdminMessages.propTypes = {};
