import React from 'react';

export default function ProfileSignupPage() {
  return (
    <section className="container container-spacer profile-signup" id="profile">
      <div className="row" aria-hidden="true">
        <div className="col-xs-12 text-center visible-xs-block profile-signup-blur">
          <img
            src="/img/avatar.png"
            alt=""
            className="visible-xs-block avatar-circle"
            width="512"
            height="512"
            aria-hidden="true"
          />
        </div>
      </div>

      <div className="row">
        <div className="col-sm-3 hidden-xs" aria-hidden="true">
          <div
            className="panel panel-default profile-signup-blur"
            id="profile-sidebar"
          >
            <img
              src="/img/avatar.png"
              alt=""
              className="hidden-xs"
              width="256"
              height="256"
              aria-hidden="true"
            />
            <div className="panel-body">
              <div className="profile-sidebar-section">Lorem ipsum</div>
              <div className="profile-sidebar-section">Lorem ipsum</div>
            </div>
          </div>
        </div>

        <div className="col-sm-9">
          <div className="row" aria-hidden="true">
            <div className="col-md-6 hidden-xs profile-signup-blur">
              <h2 className="profile-name">Firstname Lastname</h2>
              <h4 className="profile-username">@username</h4>
              <div className="profile-tagline">My mission on earth!</div>
            </div>
          </div>

          <div className="row">
            <div className="col-xs-12">
              <div className="profile-signup-action" role="dialog">
                <p className="lead">
                  Join our community to connect with this and many more members.
                </p>
                <p className="lead">
                  <a href="/signup">Become a member</a> or{' '}
                  <a href="/">read more about us</a>.
                </p>
                <p>
                  Already a member? <a href="/signin?continue=true">Login</a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
