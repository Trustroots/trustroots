import React, { Component } from 'react';
import PropTypes from 'prop-types';
import ContactPresentational from './ContactPresentational';
import RemoveContact from './RemoveContact';

export default class Contact extends Component {

  constructor(props) {
    super(props);

    this.state = {
      showRemoveModal: false,
      removeInProgress: false
    };

    this.handleRemoveContactModal = this.handleRemoveContactModal.bind(this);
    this.handleRemoveContact = this.handleRemoveContact.bind(this);
  }

  handleRemoveContactModal(show) {
    this.setState(() => ({ showRemoveModal: show }));
  }

  async handleRemoveContact() {
    this.setState(() => ({ removeInProgress: true }));
    await new Promise(resolve => setTimeout(() => resolve(), 2000)); // eslint-disable-line angular/timeout-service
    this.setState(() => ({ removeInProgress: false }));
    this.handleRemoveContactModal(false);
  }

  render() {

    const situation = getSituation(this.props.contact, this.props.selfId);

    return (<>
      <RemoveContact
        contact={this.props.contact}
        show={this.state.showRemoveModal}
        inProgress={this.state.removeInProgress}
        onHide={() => this.handleRemoveContactModal(false)}
        onRemoveContact={this.handleRemoveContact}
        situation={situation}
      />
      <ContactPresentational
        contact={this.props.contact}
        avatarSize={this.props.avatarSize}
        hideMeta={this.props.hideMeta}
        situation={situation}
        onClickRemove={() => this.handleRemoveContactModal(true)}
      />
    </>);
  }
}

Contact.propTypes = {
  contact: PropTypes.object.isRequired,
  avatarSize: PropTypes.number,
  selfId: PropTypes.string.isRequired,
  hideMeta: PropTypes.bool
};

function getSituation(contact, selfId) {
  return (contact.confirmed === false && contact.userFrom === selfId && 'unconfirmedFromMe')
    || (contact.confirmed === false && contact.userTo === selfId && 'unconfirmedToMe')
    || 'confirmed';
}
