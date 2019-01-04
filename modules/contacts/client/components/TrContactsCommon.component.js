import React from 'react';
import { NamespacesConsumer } from 'react-i18next';
import '@/config/lib/i18n';

export default class TrContactsCommon extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
        contacts: []
    }
    this.isContactsCommonList = this.isContactsCommonList.bind(this);
    this.onChange = this.onChange.bind(this);

    this.onChange();
  }

  onChange() {
      this.setState({
          contactsCommonList: this.props.contactsCommonList
      })
  }

  isContactsCommonList() {
    if(this.state.contactsCommonList.length === 0) {
        return
    }
  }
  
  render(){
    this.isContactsCommonList();

    const listContact = this.state.contacts.map((contact) => {
        return(
            <div 
                tr-contact={contact}
                tr-contact-hide-meta="true"
                tr-contact-avatar-size="64">
            </div>
        )
    })

    return (
        <div className="panel panel-default">
            <h1>HEY it works</h1>
            {/* convert ng-pluralize with NamespacesConsumer */}
            <div className="panel-body">
                <div className="contacts-contact">
                    {listContact}
                </div>
            </div>
        </div>
        );
  }
}

