// External dependencies
import React, { useState, useEffect } from 'react';

// Internal dependencies
import AdminHeader from './AdminHeader.component';

import * as api from '@/modules/tribes/client/api/tribes.api';

export default function AdminNewsletter() {
  const [circleId, setCircleId] = useState('');
  const [circles, setCircles] = useState([]);
  const [onlyNewsletterCircleMembers, setOnlyNewsletterCircleMembers] =
    useState(false);

  const fetchData = async () => {
    const circles = await api.read({ limit: 500 });
    setCircles(circles);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const now = new Date();
  const dateString = [
    now.getUTCFullYear(),
    now.getUTCMonth() + 1,
    now.getUTCDate(),
  ].join('-');

  return (
    <>
      <AdminHeader />
      <div className="container">
        <h2>Newsletter subscribers</h2>

        <p>
          <br />
          <a
            className="btn btn-primary"
            download={`trustroots-newsletter-subscribers-${dateString}.csv`}
            href="/api/admin/newsletter-subscribers"
            target="_top"
            type="text/csv"
          >
            Download CSV file of all subscribers
          </a>
          <br />
          <br />
        </p>

        <h2>Circle members</h2>
        <form>
          <div className="form-group">
            <label>
              Circle
              <select
                className="form-control"
                onChange={event => setCircleId(event.target.value)}
              >
                <option value="">Choose</option>
                {circles?.map(({ _id, label }) => (
                  <option value={_id} key={_id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="checkbox">
            <label>
              <input
                className="form-input"
                type="checkbox"
                checked={onlyNewsletterCircleMembers}
                onChange={event =>
                  setOnlyNewsletterCircleMembers(event.target.checked)
                }
              />{' '}
              Include only Newsletter subscribers
            </label>
          </div>
          {circleId && (
            <a
              className="btn btn-primary"
              download={`trustroots-circle-members-${circleId}-${dateString}.csv`}
              href={`/api/admin/newsletter-subscribers/circle?circleId=${circleId}${
                onlyNewsletterCircleMembers
                  ? '&onlyNewsletterCircleMembers'
                  : ''
              }`}
              target="_top"
              type="text/csv"
            >
              Download CSV file of selected circle
            </a>
          )}
        </form>

        <h2>Tools & resources</h2>
        <ul>
          <li>
            <a href="https://ideas.trustroots.org/wp-admin/admin.php?page=mailpoet-import">
              Import subscribers (MailPoet)
            </a>
          </li>
          <li>
            <a href="https://ideas.trustroots.org/wp-admin/admin.php?page=mailpoet-newsletters">
              Send newsletters (MailPoet)
            </a>
          </li>
          <li>
            <a href="https://app.sparkpost.com/">
              Check email sending quota and statistics (Sparkpost)
            </a>
          </li>
          <li>
            <a href="https://grafana.trustroots.org/d/000000005/transactional-emails?orgId=1">
              Check email sending health (Grafana)
            </a>
          </li>
          <li>
            <a href="https://team.trustroots.org/Newsletter.html">
              Guide to newsletters
            </a>
          </li>
        </ul>
      </div>
    </>
  );
}

AdminNewsletter.propTypes = {};
