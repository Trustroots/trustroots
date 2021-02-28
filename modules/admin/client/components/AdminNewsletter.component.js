// External dependencies
import React from 'react';

// Internal dependencies
import AdminHeader from './AdminHeader.component';

export default function AdminNewsletter() {
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
        <h2>Newsletter</h2>

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

        <h4>Tools & resources</h4>
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
