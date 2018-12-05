import React from 'react';
import PropTypes from 'prop-types';

export default class ReferencesRead extends React.Component {

  constructor(props) {
    super(props);
    this.state = {};
  }

  render() {
    return (
      <div>Read references of {this.props.user.username}.</div>
    );
  }
}

ReferencesRead.propTypes = {
  user: PropTypes.object.isRequired
};
