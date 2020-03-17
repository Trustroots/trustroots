// External dependencies
import React, { Component } from 'react';

// Internal dependencies
import { getThreads } from '../api/threads.api';
import AdminHeader from './AdminHeader.component';
import Json from './Json.component';
import UserLink from './UserLink.component';
import TimeAgo from '@/modules/core/client/components/TimeAgo';

// Mongo ObjectId is always 24 chars long
const MONGO_OBJECT_ID_LENGTH = 24;

export default class AdminThreads extends Component {
  constructor(props) {
    super(props);
    this.onUserIdChange = this.onUserIdChange.bind(this);
    this.renderResults = this.renderResults.bind(this);
    this.onSubmit = this.onSubmit.bind(this);
    this.state = {
      queried: false,
      threads: [],
      userId: '',
    };
  }

  componentDidMount() {
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('userId');

    if (userId && userId.length === MONGO_OBJECT_ID_LENGTH) {
      this.setState({ userId });
    }
  }

  onUserIdChange(event) {
    const userId = event.target.value;
    this.setState({ userId });
  }

  async onSubmit(event) {
    if (event) {
      event.preventDefault();
    }
    const { userId } = this.state;
    // Mongo ObjectId is always 24 chars long
    if (userId && userId.length === MONGO_OBJECT_ID_LENGTH) {
      const threads = await getThreads(userId);
      this.setState({ threads, queried: true });
    }
  }

  renderResults() {
    const { threads, queried, userId } = this.state;

    if (!queried && threads.length === 0) {
      return (
        <p>
          <em className="text-muted">
            {userId ? 'Press "Query"' : 'Enter member ID…'}
          </em>
        </p>
      );
    }

    if (queried && threads.length === 0) {
      return (
        <div className="alert alert-info">
          <em>Nothing found…</em>
        </div>
      );
    }

    return (
      <>
        <h3>Messages from/to them</h3>
        {threads.map(thread => {
          const { _id } = thread;
          return (
            <div className="panel panel-default" key={_id}>
              <div className="panel-body">
                <p>
                  <UserLink user={thread.userFromProfile[0]} />
                  {' → '}
                  <UserLink user={thread.userToProfile[0]} />
                  {` (${thread.read ? 'read' : 'unread'})`}
                </p>
                <p>
                  <TimeAgo date={thread.updated} />
                  {` (${thread.updated})`}
                </p>
                <details>
                  <summary>Thread details</summary>
                  <Json content={thread} />
                </details>
              </div>
            </div>
          );
        })}
      </>
    );
  }

  render() {
    const { userId } = this.state;

    return (
      <>
        <AdminHeader />
        <div className="container">
          <h2>Threads</h2>
          <form className="form-inline" onSubmit={this.onSubmit}>
            <input
              aria-label="Member ID"
              className="form-control input-lg"
              maxLength={MONGO_OBJECT_ID_LENGTH}
              name="userId"
              onChange={this.onUserIdChange}
              placeholder="Member ID"
              size={MONGO_OBJECT_ID_LENGTH + 2}
              type="text"
              value={userId}
            />
            <button
              className="btn btn-lg btn-default"
              disabled={userId.length !== MONGO_OBJECT_ID_LENGTH}
              type="submit"
            >
              Query
            </button>
          </form>
          <br />
          {this.renderResults()}
        </div>
      </>
    );
  }
}

AdminThreads.propTypes = {};
