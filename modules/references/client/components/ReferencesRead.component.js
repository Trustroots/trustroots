import React from 'react';
import PropTypes from 'prop-types';
import ReferencesReadPresentational from './read-references/ReferencesReadPresentational';
import * as references from '../api/references.api';
import Loading from '@/modules/core/client/components/Loading';

const api = { references };

/**
 * This is a container component for a list of user's References
 */
export default class ReferencesRead extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      references: null
    };
  }

  async componentDidMount() {
    const references = await api.references.read({ userTo: this.props.user._id });

    this.setState(() => ({ references }));
  }

  render() {

    if (!this.state.references) return <Loading />;

    const publicReferences = this.state.references.filter(reference => reference.public).sort((a, b) => a.created < b.created);
    const nonpublicReferences = this.state.references.filter(reference => !reference.public).sort((a, b) => a.created > b.created);

    return (
      <ReferencesReadPresentational
        user={this.props.user}
        publicReferences={publicReferences}
        nonpublicReferences={nonpublicReferences}
      />
    );
  }
}

ReferencesRead.propTypes = {
  user: PropTypes.object.isRequired
};
