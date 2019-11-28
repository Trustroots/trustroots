// External dependencies
import React, { Component } from 'react';

// Internal dependencies
import { getAcquisitionStories } from '../api/acquisition-stories.api';
import AdminHeader from './AdminHeader.component';

export default class AdminAcquisitionStories extends Component {
  constructor(props) {
    super(props);
    this.state = {
      acquisitionStories: []
    };
  }

  async componentDidMount() {
    const acquisitionStories = await getAcquisitionStories();
    this.setState({ acquisitionStories });
  }

  render() {
    const { acquisitionStories } = this.state;

    return (
      <>
        <AdminHeader />
        <div className="container">
          <h2>Acquisition stories</h2>
          <p>Showing 1000 latest.</p>
          { acquisitionStories.length ? (
            acquisitionStories.map((story) => (
              <div key={ story._id} className="panel" id={story._id}>
                <div className="panel-body">
                  <p className="lead">
                    { story.acquisitionStory }
                  </p>
                  <ul className="list-inline">
                    <li><a href={`#${story._id}`}><time className="text-muted">{ story.created }</time></a></li>
                    <li><a href={`/admin/user?id=${story._id}`}>Member report card</a></li>
                  </ul>
                </div>
              </div>
            ))
          ) : <p>No acquisition stories found...</p> }
        </div>
      </>
    );
  }
}

AdminAcquisitionStories.propTypes = {};
