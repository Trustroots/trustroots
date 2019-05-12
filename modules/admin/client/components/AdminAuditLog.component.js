// External dependencies
import React, { Component } from 'react';

// Internal dependencies
import { getAuditLog } from '../api/audit-log.api';
import AdminHeader from './AdminHeader.component.js';
import UserLink from './UserLink.component.js';

export default class AdminAuditLog extends Component {
  constructor(props) {
    super(props);
    this.state = {
      auditLog: []
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
          { auditLog.length ? (
            auditLog.map((item) => (
              <div key={ item._id } className="panel">
                <div className="panel-heading">
                  { item.route ? <code>{ item.route }</code> : <em>Unknown route</em> }
                </div>
                <div className="panel-body">
                  <small className="pull-right text-muted">Audit log ID: <code>{ item._id }</code></small>
                  <p>By <UserLink user={ item.user || {} } /> ({ item.ip || 'Unknown IP address' }), <time>{ item.date }</time></p>
                  {
                    ['body', 'params', 'query'].map((type) => item[type] && (
                      <pre key={ type }>
                        { `${ type }: ` }
                        { JSON.stringify(item[type], null, 2) }
                      </pre>
                    ))
                  }
                </div>
              </div>
            ))
          ) : <p>Nothing found...</p> }
        </div>
      </>
    );
  };
}

AdminAuditLog.propTypes = {};
