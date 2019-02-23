import React, { Component } from 'react';
import PropTypes from 'prop-types';
import ContactPresentational from './ContactPresentational';
import RemoveContact from './RemoveContact';
import * as contacts from '../api/contacts.api';

const api = { contacts };

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

  handleRemoveContactModal(showRemoveModal) {
    this.setState(() => ({ showRemoveModal }));
  }

  async handleRemoveContact() {
    this.setState(() => ({ removeInProgress: true }));
    await api.contacts.remove(this.props.contact._id);
    this.setState(() => ({ removeInProgress: false }));
    this.handleRemoveContactModal(false);
    // broadcast the change to angular
    this.props.onContactRemoved(this.props.contact);
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
        className={this.props.className}
        contact={this.props.contact}
        avatarSize={this.props.avatarSize}
        hideMeta={this.props.hideMeta}
        situation={situation}
        onClickRemove={() => this.handleRemoveContactModal(true)}
      />
    </>);
  }
}

Contact.defaultProps = {
  onContactRemoved: () => {}
};

Contact.propTypes = {
  className: PropTypes.string,
  contact: PropTypes.object.isRequired,
  avatarSize: PropTypes.number,
  selfId: PropTypes.string.isRequired,
  hideMeta: PropTypes.bool,
  // this is a function provided from Angular. It broadcasts the information that a contact was removed.
  // @TODO this won't be needed when migration is finished
  onContactRemoved: PropTypes.func
};

function getSituation(contact, selfId) {
  return (contact.confirmed === false && contact.userFrom === selfId && 'unconfirmedFromMe')
    || (contact.confirmed === false && contact.userTo === selfId && 'unconfirmedToMe')
    || 'confirmed';
}
