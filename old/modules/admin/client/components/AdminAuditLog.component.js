// External dependencies
import React, { Component } from 'react';

// Internal dependencies
import { getAuditLog } from '../api/audit-log.api';
import AdminHeader from './AdminHeader.component';
import Json from './Json.component';
import UserLink from './UserLink.component';

export default class AdminAuditLog extends Component {
  constructor(props) {
    super(props);
    this.state = {
      auditLog: [],
    };
  }

  async componentDidMount() {
    const auditLog = await getAuditLog();
    this.setState({ auditLog });
  }

  render() {
    const { auditLog } = this.state;

    return (
      <>
        <AdminHeader />
        <div className="container">
          <h2>Audit log</h2>
          <p>100 latest queries performed via admin dash.</p>
          {auditLog.length ? (
            auditLog.map(item => (
              <div key={item._id} className="panel">
                <div className="panel-heading">
                  {item.route ? (
                    <samp>{item.route}</samp>
                  ) : (
                    <em>Unknown route</em>
                  )}
                </div>
                <div className="panel-body">
                  <small className="pull-right text-muted">
                    Audit log ID: <samp>{item._id}</samp>
                  </small>
                  <p>
                    By <UserLink user={item.user || {}} /> (
                    {item.ip || 'Unknown IP address'}), <time>{item.date}</time>
                  </p>
                  {['body', 'params', 'query'].map(
                    type =>
                      item[type] && (
                        <div key={type}>
                          <h5>{`${type}: `}</h5>
                          <Json content={item[type]} />
                        </div>
                      ),
                  )}
                </div>
              </div>
            ))
          ) : (
            <p>Nothing found...</p>
          )}
        </div>
      </>
    );
  }
}

AdminAuditLog.propTypes = {};
