import React from 'react';
// import { NamespacesConsumer } from 'react-i18next';
import PropTypes from 'prop-types';
import Contact from './Contact.component';
import { getContactsCommon } from '../api/contacts.api';
import '@/config/lib/i18n';

export default class ContactsCommon extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      contacts: []
    };
  }

  componentDidMount() {
    const profileId = this.props.profileId;
    getContactsCommon(profileId)
      .then(lists => {
        this.setState({
          contacts: lists
        });
      });

  }

  render() {
    const isContactsCommonList = this.state.contacts.length;

    if (!isContactsCommonList) return null;
    return (
      <div className="panel panel-default">
        {/* convert ng-pluralize with NamespacesConsumer */}
        <div className="panel-body">
          <div className="contacts-contact">
            {this.state.contacts.map((contact) =>
              <div key={contact._id.toString()}>
                <Contact
                  contact={contact}
                  hide-meta={true}
                  avatar-size={64}
                  selfId={this.props.profileId}
                />
              </div>)}
          </div>
        </div>
      </div>
    );
  }
}

ContactsCommon.propTypes = {
  profileId: PropTypes.string
};