import React from 'react';
import PropTypes from 'prop-types';
import ContactListPresentational from './ContactListPresentational';
import LoadingIndicator from '@/modules/core/client/components/LoadingIndicator';
import NoContent from '@/modules/core/client/components/NoContent';

export default class ContactList extends React.Component {

  constructor(props) {
    super(props);

    this.state = {
      filter: '',
    };

    this.handleFilterChange = this.handleFilterChange.bind(this);
  }

  handleFilterChange(filter) {
    this.setState(() => ({ filter }));
  }

  render() {

    const { appUser, contacts, onContactRemoved } = this.props;

    if (!contacts || !contacts.$resolved) {
      return <LoadingIndicator />;
    }

    if (contacts.length === 0) {
      return (
        <NoContent icon="users" message="No contacts yet." />
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
  onContactRemoved: PropTypes.func.isRequired,
};
