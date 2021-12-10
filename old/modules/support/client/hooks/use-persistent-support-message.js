import createPersistedState from 'use-persisted-state';

// Module name + hook name as a key
const useSupportMessageState = createPersistedState('support-message');

// Persists support message in browser so that they don't lose it accidentally on browser refresh or other issue
const usePersistentSupportMessage = initialSupportMessage => {
  const [supportMessage, setSupportMessage] = useSupportMessageState(
    initialSupportMessage,
  );

  return [
    supportMessage,
    newSupportMessage => setSupportMessage(newSupportMessage),
  ];
};

export default usePersistentSupportMessage;
