import useLocalStorageState from 'use-local-storage-state';

// Persists support message in browser so that they don't lose it accidentally on browser refresh or other issue
type PersistentSupportMessageState = [
  string,
  (newSupportMessage: string) => void,
];

const usePersistentSupportMessage = (
  initialSupportMessage: string,
): PersistentSupportMessageState => {
  const [supportMessage, setSupportMessage] = useLocalStorageState(
    'support-message',
    { defaultValue: initialSupportMessage },
  );

  return [
    supportMessage,
    (newSupportMessage: string) => setSupportMessage(newSupportMessage),
  ];
};

export default usePersistentSupportMessage;
