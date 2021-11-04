/**
 * A panel with basic user info in user profile.
 * It wraps Avatar, a Modal with Avatar and ProfileViewBasics components.
 * @param {Object} profile - displayed user's profile data
 */

import React from 'react';
import PropTypes from 'prop-types';
import useFields from '@/modules/core/client/hooks/useFields';
import TrEditor from '@/modules/core/client/components/TrEditor';
import { update } from '@/modules/users/client/api/users.api';

export default function ProfileEditAbout({ app }) {
  const [fields, handleChange, modified] = useFields(app.user);

  const handleSubmit = async e => {
    // TODO: validation
    e.preventDefault();
    const resp = await update(fields);
    console.log(resp);
    // TODO: how to add things to messageCenterService from react???
  };

  const {
    description,
    firstName,
    lastName,
    tagline,
    gender,
    birthdate,
    languages,
  } = fields;

  return (
    <form
      name="userForm"
      onSubmit={handleSubmit}
      autoComplete="off"
      tr-confirm-exit // TODO: implement this
    >
      <div className="panel panel-default">
        <label htmlFor="description" className="panel-heading">
          Describe Yourself
        </label>
        <div className="panel-body">
          <div className="form-group">
            <TrEditor
              id="description"
              className="profile-edit-description"
              aria-describedby="descriptionHelp"
              name="description"
              text={description}
              onChange={value =>
                handleChange({ target: { name: 'description', value } })
              }
              placeholder="Type in your description…"
            />
            <p className="help-block">
              Help other people get to know you by telling them about your life
              and the things you like.
            </p>

            {description.length < 3 * app.appSettings.profileMinimumLength ? (
              <p className="help-block">
                Interesting and full profile will help you to meet more like
                minded people and to find hosts easier.
              </p>
            ) : (
              false
            )}

            {description.length > 0 &&
            description.length < app.appSettings.profileMinimumLength ? (
              <p className="help-block">
                <strong className="text-danger pull-left">
                  Write longer description in order to send messages to other
                  members.
                </strong>
                <uib-progressbar
                  className="profile-edit-description-progress pull-left"
                  max={app.appSettings.profileMinimumLength}
                  value={description.length}
                ></uib-progressbar>
              </p>
            ) : (
              false
            )}

            {description.length === 0 ? (
              <p className="help-block">
                <strong className="text-danger pull-left">
                  Fill out description in order to send messages to other
                  members.
                </strong>
              </p>
            ) : (
              false
            )}
          </div>
        </div>
        <div className="panel-footer">
          <div id="descriptionHelp" className="help-block">
            <small>
              Highlight text to add links or change text appearance.
            </small>
          </div>
        </div>
      </div>

      <p>
        <button
          type="submit"
          className="btn btn-lg btn-primary profile-editor-save"
          disabled={!modified}
        >
          Save
        </button>
        <br />
        <br />
      </p>

      <div className="panel panel-default">
        <div className="panel-heading">Basics</div>
        <div className="panel-body">
          <div className="form-horizontal">
            <div className="form-group">
              <label
                htmlFor="firstname"
                className="col-sm-3 text-right control-label"
              >
                First name
              </label>
              <div className="col-sm-9 col-md-7 col-lg-6">
                <input
                  type="text"
                  className="form-control"
                  id="firstname"
                  name="firstName"
                  value={firstName}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-group">
              <label
                htmlFor="lastname"
                className="col-sm-3 text-right control-label"
              >
                Last name
              </label>
              <div className="col-sm-9 col-md-7 col-lg-6">
                <input
                  type="text"
                  className="form-control"
                  id="lastname"
                  name="lastName"
                  value={lastName}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-group">
              <label
                htmlFor="tagline"
                className="col-sm-3 text-right control-label"
              >
                Short tagline
              </label>
              <div className="col-sm-9 col-md-7 col-lg-6">
                <input
                  type="text"
                  className="form-control"
                  data-placeholder="lorem"
                  id="tagline"
                  name="tagline"
                  value={tagline}
                  onChange={handleChange}
                />
                <p className="help-block">
                  What is your mission or life motto?
                </p>
              </div>
            </div>

            <div className="form-group">
              <label
                htmlFor="gender"
                className="col-sm-3 text-right control-label"
              >
                I Am
              </label>
              <div className="col-sm-9 col-md-7 col-lg-6">
                <select
                  className="form-control"
                  id="gender"
                  name="gender"
                  value={gender}
                  onChange={handleChange}
                >
                  <option value="">I&apos;d rather not tell</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="non-binary">Non-binary</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="col-sm-3 text-right control-label">
                Birthdate
              </label>
              <div className="col-sm-9">
                <div
                  tr-date-select // TODO: implement date selector
                  template-url="tr-birthdate-select.html"
                  name="birthdate"
                  value={birthdate}
                  onChange={handleChange}
                ></div>
                <script type="text/ng-template" id="tr-birthdate-select.html">
                  <div className="form-inline">
                    <label className="sr-only" htmlFor="birthdate-month">
                      Month
                    </label>
                    <select
                      className="form-control"
                      id="birthdate-month"
                      ng-model="val.month"
                      ng-options="m.value as m.name for m in months"
                    >
                      <option value="">Month</option>
                    </select>

                    <label className="sr-only" htmlFor="birthdate-date">
                      Date
                    </label>
                    <select
                      className="form-control"
                      id="birthdate-date"
                      ng-model="val.date"
                      ng-options="d for d in dates track by d"
                    >
                      <option value="">Day</option>
                    </select>

                    <label className="sr-only" htmlFor="birthdate-year">
                      Year
                    </label>
                    <select
                      className="form-control"
                      id="birthdate-year"
                      ng-model="val.year"
                      ng-options="y for y in ::years"
                    >
                      <option value="">Year</option>
                    </select>
                  </div>
                </script>
              </div>
            </div>

            <div className="form-group">
              <label
                className="col-sm-3 text-right control-label"
                id="label-languages"
              >
                Languages
              </label>
              <div className="col-sm-9 col-md-7 col-lg-6">
                <div
                  tr-languages="profileEditAbout.user.languages" // TODO: implement this
                  name="languages"
                  onChange={handleChange}
                  value={languages}
                  aria-labelledby="label-languages"
                ></div>
                <p className="help-block">Add languages you speak.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <button
        type="submit"
        className="btn btn-lg btn-primary profile-editor-save"
        disabled={!modified}
      >
        Save
      </button>
    </form>
  );
}

ProfileEditAbout.propTypes = {
  app: PropTypes.object.isRequired,
};
