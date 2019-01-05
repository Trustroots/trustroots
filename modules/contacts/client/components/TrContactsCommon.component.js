import React from 'react';
import { NamespacesConsumer } from 'react-i18next';
import '@/config/lib/i18n';

export default class TrContactsCommon extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      contactsCommonList: []
    };
    this.isContactsCommonList = this.isContactsCommonList.bind(this);
  }

  isContactsCommonList() {
    if (this.state.contactsCommonList.length === 0) {
      return;
    }
  }
  render() {
    this.isContactsCommonList();

    const listContact = this.state.contactsCommonList.map((contact) => {
      return (
        <div key={contact}>
          <div
            tr-contact={contact}
            tr-contact-hide-meta="true"
            tr-contact-avatar-size="64"
          >
          </div>
        </div>
      );
    });

    return (
      <NamespacesConsumer>
        <div className="panel panel-default">
          {/* convert ng-pluralize with NamespacesConsumer */}
          <div className="panel-body">
            <div className="contacts-contact">
              {listContact}
            </div>
          </div>
        </div>
      </NamespacesConsumer>
    );
  }
}

TrContactsCommon.propTypes = {};