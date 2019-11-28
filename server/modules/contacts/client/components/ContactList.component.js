import React from 'react';
import PropTypes from 'prop-types';
import ContactListPresentational from './ContactListPresentational';

export default class ContactList extends React.Component {

  constructor(props) {
    super(props);

    this.state = {
      filter: ''
    };

    this.handleFilterChange = this.handleFilterChange.bind(this);
  }

  handleFilterChange(filter) {
    this.setState(() => ({ filter }));
  }

  render() {

    const { appUser, contacts, onContactRemoved } = this.props;

    // @TODO replace with a reusable Loading info
    if (!contacts || !contacts.$resolved) return <div>Wait a moment...</div>;

    if (contacts.length === 0) {
      return (
        <div className="row content-empty">
          <i className="icon-3x icon-users"></i>
          <h4>No contacts yet.</h4>
        </div>
      );
    }

    return (
      <ContactListPresentational
        selfId={appUser._id}
        contacts={contacts}
        filter={this.state.filter}
        onFilterChange={this.handleFilterChange}
        onContactRemoved={onContactRemoved}
      />
    );
  }
}

ContactList.propTypes = {
  contacts: PropTypes.array,
  appUser: PropTypes.object.isRequired,
  onContactRemoved: PropTypes.func.isRequired
};
