import type { ProfileContacts } from '@/modules/users/client/profile-contacts';
import { getByUserId, list } from './api/contacts.api';
import ContactList from './components/ContactList.component';
import ContactsCommon from './components/ContactsCommon.component';
import RemoveContactContainer from './components/RemoveContactContainer';

export const profileContacts = {
  list,
  getByUserId,
  Common: ContactsCommon,
  List: ContactList,
  Remove: RemoveContactContainer,
} satisfies ProfileContacts;
