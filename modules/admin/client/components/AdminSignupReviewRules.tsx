import React, { useEffect, useState } from 'react';
import http, { getErrorMessage } from '../../../core/client/api/http-client';
import { Button } from '@trustroots/ui/Button';
import AdminHeader from './AdminHeader.component';

type RuleKind = 'keyword' | 'email' | 'domain';
interface Rule {
  kind: RuleKind;
  value: string;
}
interface RulesResponse {
  revision: number;
  rules: Rule[];
}

const endpoint = '/api/admin/signup-review-rules';

export default function AdminSignupReviewRules() {
  const [revision, setRevision] = useState<number | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [newKind, setNewKind] = useState<RuleKind>('keyword');
  const [newValue, setNewValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    http
      .get<RulesResponse>(endpoint)
      .then(({ data }) => {
        if (!active) return;
        setRevision(data.revision);
        setRules(data.rules);
      })
      .catch(cause => {
        if (active)
          setError(
            getErrorMessage(cause, 'Could not load the signup watchlist.'),
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  function updateRule(index: number, update: Partial<Rule>) {
    setRules(current =>
      current.map((rule, row) =>
        row === index ? { ...rule, ...update } : rule,
      ),
    );
    setSaved(false);
  }

  function addRule() {
    const value = newValue.trim();
    if (!value) {
      setError('Enter a value for the rule.');
      return;
    }
    setRules(current => [...current, { kind: newKind, value }]);
    setNewValue('');
    setError('');
    setSaved(false);
  }

  function removeRule(index: number) {
    setRules(current => current.filter((_, row) => row !== index));
    setSaved(false);
  }

  async function saveRules() {
    if (revision === null) return;
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const { data } = await http.put<RulesResponse>(endpoint, {
        revision,
        rules: rules.map(rule => ({ ...rule, value: rule.value.trim() })),
      });
      setRevision(data.revision);
      setRules(data.rules);
      setSaved(true);
    } catch (cause) {
      setError(
        getErrorMessage(
          cause,
          'Could not save the signup watchlist. It may have changed; reload and review the latest rules.',
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <AdminHeader />
      <main className="container admin-page">
        <h1>Signup watchlist</h1>
        <p>
          Matching signups are allowed and flagged to alert staff for review.
          Watchlist rules do not block signups.
        </p>
        {loading && <p role="status">Loading signup watchlist…</p>}
        {error && <p role="alert">{error}</p>}
        {saved && <p role="status">Signup watchlist saved.</p>}
        {!loading && revision !== null && (
          <>
            <table className="table table-striped" aria-label="Watchlist rules">
              <thead>
                <tr>
                  <th scope="col">Type</th>
                  <th scope="col">Value</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule, index) => (
                  <tr key={index}>
                    <td>
                      <label className="sr-only" htmlFor={`rule-kind-${index}`}>
                        Rule {index + 1} type
                      </label>
                      <select
                        id={`rule-kind-${index}`}
                        aria-label={`Rule ${index + 1} type`}
                        className="form-control"
                        value={rule.kind}
                        disabled={saving}
                        onChange={event =>
                          updateRule(index, {
                            kind: event.target.value as RuleKind,
                          })
                        }
                      >
                        <option value="keyword">Keyword</option>
                        <option value="email">Email address</option>
                        <option value="domain">Email domain</option>
                      </select>
                    </td>
                    <td>
                      <label
                        className="sr-only"
                        htmlFor={`rule-value-${index}`}
                      >
                        Rule {index + 1} value
                      </label>
                      <input
                        id={`rule-value-${index}`}
                        aria-label={`Rule ${index + 1} value`}
                        className="form-control"
                        maxLength={254}
                        value={rule.value}
                        disabled={saving}
                        onChange={event =>
                          updateRule(index, { value: event.target.value })
                        }
                      />
                    </td>
                    <td>
                      <Button
                        type="button"
                        disabled={saving}
                        onClick={() => removeRule(index)}
                      >
                        Remove rule {index + 1}
                      </Button>
                    </td>
                  </tr>
                ))}
                <tr>
                  <td>
                    <label className="sr-only" htmlFor="new-rule-kind">
                      New rule type
                    </label>
                    <select
                      id="new-rule-kind"
                      className="form-control"
                      value={newKind}
                      disabled={saving}
                      onChange={event =>
                        setNewKind(event.target.value as RuleKind)
                      }
                    >
                      <option value="keyword">Keyword</option>
                      <option value="email">Email address</option>
                      <option value="domain">Email domain</option>
                    </select>
                  </td>
                  <td>
                    <label className="sr-only" htmlFor="new-rule-value">
                      New rule value
                    </label>
                    <input
                      id="new-rule-value"
                      className="form-control"
                      maxLength={254}
                      value={newValue}
                      disabled={saving}
                      onChange={event => setNewValue(event.target.value)}
                      onKeyDown={event => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          addRule();
                        }
                      }}
                    />
                  </td>
                  <td>
                    <Button type="button" disabled={saving} onClick={addRule}>
                      Add rule
                    </Button>
                  </td>
                </tr>
              </tbody>
            </table>
            <Button
              type="button"
              disabled={saving}
              onClick={() => void saveRules()}
            >
              {saving ? 'Saving…' : 'Save rules'}
            </Button>
          </>
        )}
      </main>
    </>
  );
}
