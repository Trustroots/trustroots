import React from 'react';
import { withTranslation } from '@/modules/core/client/utils/i18n-angular-load';
import PropTypes from 'prop-types';
import Contact from './Contact';
import { getContactsCommon } from '../api/contacts.api';
import '@/config/client/i18n';

export class ContactsCommon extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      contacts: [],
    };
  }

  async componentDidMount() {
    const { profileId } = this.props;
    const contacts = await getContactsCommon(profileId);
    this.setState({ contacts });
  }

  render() {
    const { t } = this.props;
    const isContactsCommonList = this.state.contacts.length;

    if (!isContactsCommonList) return null;
    return (
      <div className="panel panel-default">
        {/* convert ng-pluralize with NamespacesConsumer */}
        <div className="panel-heading">
          {t('{{count}} contacts in common', {
            count: this.state.contacts.length,
          })}
        </div>
        <div className="panel-body">
          {this.state.contacts.map(contact => (
            <Contact
              key={contact._id}
              contact={contact}
              className="contacts-contact"
              hideMeta={true}
              avatarSize={64}
              selfId={this.props.profileId}
            />
          ))}
        </div>
      </div>
    );
  }
}

ContactsCommon.propTypes = {
  profileId: PropTypes.string,
  t: PropTypes.func.isRequired,
};

export default withTranslation('contact')(ContactsCommon);
