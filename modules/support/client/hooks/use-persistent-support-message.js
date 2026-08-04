import useLocalStorageState from 'use-local-storage-state';

// Persists support message in browser so that they don't lose it accidentally on browser refresh or other issue
const usePersistentSupportMessage = initialSupportMessage => {
  const [supportMessage, setSupportMessage] = useLocalStorageState(
    'support-message',
    { defaultValue: initialSupportMessage },
  );

  return [
    supportMessage,
    newSupportMessage => setSupportMessage(newSupportMessage),
  ];
};

export default usePersistentSupportMessage;
