import React, { useState } from 'react';

import TrEditor from '@/modules/messages/client/components/TrEditor';

export default function ThreadReply() {
  const [content, setContent] = useState('');
  function send(e){
    e.preventDefault();
    e.stopPropagation();
    // eslint-disable-next-line no-console
    console.log('would send', content);
    setContent(''); // @TODO this doesn't clear the input for some reason
  }
  return (
    <form
      id="message-reply"
      name="messageForm"
      className="form-horizontal"
      onSubmit={e => send(e)}
    >
      <div className="row">
        <div className="col-xs-12">
          <div className="panel panel-default">
            <TrEditor
              id="message-reply-content"
              text={content}
              onChange={text => setContent(text)}
            />
          </div>
        </div>
      </div>
      <div className="col-xs-2 col-sm-12">
        <small className="text-muted hidden-xs">
          Highlight text to add links or change its appearance.
          Ctrl+Enter to send.
        </small>
        <button
          id="messageReplySubmit"
          className="btn btn-md btn-primary message-reply-btn"
          type="submit"
        >
          <i className="icon-send"/><span className="hidden-xs"> Send</span>
        </button>
      </div>
    </form>
  );
}
