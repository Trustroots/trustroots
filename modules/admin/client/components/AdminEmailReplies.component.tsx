import React, { useState } from 'react';
import { Button } from '@trustroots/ui/Button';
import axios from '../../../core/client/api/http-client';
import type { EmailRepliesPreview } from '../../shared/email-replies';
import { formatAdminDateTime } from '../utils/admin-date';
import AdminHeader from './AdminHeader.component';

export default function AdminEmailReplies() {
  const [result, setResult] = useState<EmailRepliesPreview>();
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  async function preview() {
    setLoading(true);
    setFailed(false);
    setResult(undefined);
    try {
      const response = await axios.get<EmailRepliesPreview>(
        '/api/admin/email-replies',
        { timeout: 50000 },
      );
      setResult(response.data);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <AdminHeader />
      <div className="container">
        <h2>Email replies</h2>
        <p>Preview up to 20 unprocessed emails from the reply mailbox.</p>
        <Button disabled={loading} onClick={() => void preview()}>
          Check mailbox
        </Button>
        {loading && <p role="status">Checking the reply mailbox…</p>}
        {failed && <p role="alert">Could not read the reply mailbox.</p>}
        {result?.status === 'unconfigured' && (
          <p role="status">The reply mailbox is not configured.</p>
        )}
        {result?.status === 'preview' && (
          <>
            <p role="status">
              Mailbox checked at {formatAdminDateTime(result.checkedAt)} UTC.
            </p>
            {result.replies.length === 0 ? (
              <p>No unprocessed email replies.</p>
            ) : (
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">Sender</th>
                      <th scope="col">Parsing</th>
                      <th scope="col">Conversation match</th>
                      <th scope="col">Preview</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.replies.map(reply => (
                      <tr key={reply.id}>
                        <td>{reply.sender}</td>
                        <td>{reply.parseResult}</td>
                        <td>
                          {reply.matching}
                          {reply.candidates.length > 0 && (
                            <div>
                              Message links in email point to{' '}
                              {reply.candidates.join(', ')}.
                            </div>
                          )}
                        </td>
                        <td>
                          <details>
                            <summary>Show reply</summary>
                            <p>To {reply.recipients.join(', ')}</p>
                            <h3>Extracted reply</h3>
                            <pre>{reply.extractedText}</pre>
                            <h3>Source text</h3>
                            <pre>{reply.sourceText}</pre>
                          </details>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
