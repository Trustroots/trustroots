import React from 'react';
import PropTypes from 'prop-types';
import Reference from './read-references/Reference';
import * as references from '../api/references.api';

const api = { references };

export default class ReferencesRead extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      references: [],
      isLoading: true
    };
  }

  async componentDidMount() {
    const references = await api.references.read({ userTo: this.props.user._id });

    this.setState(() => ({
      isLoading: false,
      references
    }));
  }

  render() {
    return (<>
      {this.state.isLoading && <div>loading...</div>}
      <div>Read references of {this.props.user.username}.</div>
      <ul>
        {this.state.references.map(reference => (
          <li key={reference._id} id={reference._id}>
            <Reference reference={reference} />
          </li>
        ))}
      </ul>
    </>);
  }
}

ReferencesRead.propTypes = {
  user: PropTypes.object.isRequired
};
