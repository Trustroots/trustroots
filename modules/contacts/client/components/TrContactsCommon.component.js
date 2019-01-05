import React from 'react';
// import { NamespacesConsumer } from 'react-i18next';
import PropTypes from 'prop-types';
import { contactsCommonListService } from '../services/contacts-common-list.client.service';
import '@/config/lib/i18n';

export default class TrContactsCommon extends React.Component {
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
    // this.onChange();
    this.isContactsCommonList();
    return (
      <div className="panel panel-default">
        <h1> it works</h1>
        {/* convert ng-pluralize with NamespacesConsumer */}
        <div className="panel-body">
          <div className="contacts-contact">
            {this.state.contacts.map((contact) => {
              console.log(contact.user.displayName);
              return (
                <div key={contact}>
                  <div tr-contact={contact.user.displayName}
                    tr-contact-hide-meta="true"
                    tr-contact-avatar-size="64">
                  </div>
                </div>);})}
          </div>
        </div>
      </div>
    );
  }
}

TrContactsCommon.propTypes = {
  contacts: PropTypes.object
};