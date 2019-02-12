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
    this.isContactsCommonList = this.isContactsCommonList.bind(this);
    this.onChange = this.onChange.bind(this);
  }

  isContactsCommonList() {
    if (this.state.contacts.length === 0) {
      return;
    }
  }

  async onChange() {
    const profileId = this.props.profileId;
    const lists = await getContactsCommon(profileId);
    this.setState({
      contacts: lists
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