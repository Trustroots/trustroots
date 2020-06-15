import React, { useState, useCallback, useMemo, useRef } from 'react';
import useWebSocket, { ReadyState } from 'react-use-websocket';

export default function WebSocketDemo() {
  // Public API that will echo messages sent to it back to the client
  const [socketUrl] = useState('ws://localhost:3030');
  const messageHistory = useRef([]);

  const { sendMessage, lastMessage, readyState } = useWebSocket(socketUrl);

  messageHistory.current = useMemo(
    () => messageHistory.current.concat(lastMessage),
    [lastMessage],
  );

  const handleClickSendMessage = useCallback(() => sendMessage('Hello'), []);

  const connectionStatus = {
    [ReadyState.CONNECTING]: 'Connecting',
    [ReadyState.OPEN]: 'Open',
    [ReadyState.CLOSING]: 'Closing',
    [ReadyState.CLOSED]: 'Closed',
    [ReadyState.UNINSTANTIATED]: 'Uninstantiated',
  }[readyState];

  return (
    <div>
      <button
        onClick={handleClickSendMessage}
        disabled={readyState !== ReadyState.OPEN}
      >
        Send
      </button>
      <br />
      <br />
      <span>
        The WebSocket is currently <strong>{connectionStatus}</strong>
      </span>
      {lastMessage?.data ? <span>Last message: {lastMessage.data}</span> : null}
      <br />
      <br />
      <ul>
        {messageHistory.current.map((message, idx) => (
          <li key={idx}>{message?.data || 'none'}</li>
        ))}
      </ul>
    </div>
  );
}
