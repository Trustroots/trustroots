import React from 'react';
// import { NamespacesConsumer } from 'react-i18next';
import PropTypes from 'prop-types';
import Contact from './Contact.component';
import { contactsCommonListService } from '../services/contacts-common-list.client.service';
import '@/config/lib/i18n';

export default class ContactsCommon extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      contacts: []
    };
    this.isContactsCommonList = this.isContactsCommonList.bind(this);
    this.onChange = this.onChange.bind(this);
  }
  isContactsCommonList() {
    if (this.state.contacts.length === 0) {
      return;
    }
  }
  async onChange() {
    const contacts = this.props.contacts;
    const list = await contactsCommonListService(contacts);
    console.log(list[0]);
    this.setState({
      contacts: list
    });
  }

  componentDidMount() {
    this.onChange();
  }
  render() {
    this.isContactsCommonList();
    return (
      <div className="panel panel-default">
        {/* convert ng-pluralize with NamespacesConsumer */}
        <div className="panel-body">
          <div className="contacts-contact">
            {this.state.contacts.map((contact) => {
              console.log(contact.user.displayName);
              return (
                <div key={contact}>
                  <Contact
                    contact={contact}
                    hide-meta="true"
                    avatar-size="64"
                    selfId={this.props.contacts}
                  />
                </div>);})}
          </div>
        </div>
      </div>
    );
  }
}

TrContactsCommon.propTypes = {
  contacts: PropTypes.string
};