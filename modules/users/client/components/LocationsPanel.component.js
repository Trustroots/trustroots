import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as api from '@/modules/users/client/api/users.api';
import PropTypes from 'prop-types';
import LocationTypeahead from './LocationTypeahead';
import { $broadcast } from '@/modules/core/client/services/angular-compat';

export default function LocationsPanel({
  username,
  successMessageCallback,
  errorMessageCallback,
}) {
  const { t } = useTranslation('users');

  const [initLocationFrom, setInitLocationFrom] = useState(null);
  const [initLocationLiving, setInitLocationLiving] = useState(null);

  const [newLocationFrom, setNewLocationFrom] = useState(null);
  const [newLocationLiving, setNewLocationLiving] = useState(null);

  const [unsavedModifications, setUnsavedModifications] = useState(false);

  useEffect(() => {
    api
      .fetch(username)
      .then(data => {
        setInitLocationLiving(data.locationLiving);
        setInitLocationFrom(data.locationFrom);
      })
      .catch(() => {
        errorMessageCallback(null);
      });
  }, []);

  const onSubmit = async event => {
    event.preventDefault();
    if (unsavedModifications) {
      api
        .update({
          locationFrom: newLocationFrom || initLocationFrom,
          locationLiving: newLocationLiving || initLocationLiving,
        })
        .then(() => {
          setUnsavedModifications(false);
          $broadcast('userUpdated');
          successMessageCallback();
        })
        .catch(() => errorMessageCallback(null));
    }
  };

  function onInputChangeLocationFrom(newValue) {
    setNewLocationFrom(newValue);
    updateUnsavedModificationsState(initLocationFrom !== newValue);
  }

  function onInputChangeLocationLiving(newValue) {
    setNewLocationLiving(newValue);
    updateUnsavedModificationsState(initLocationLiving !== newValue);
  }

  function updateUnsavedModificationsState(unsavedModificationsPresent) {
    setUnsavedModifications(unsavedModificationsPresent);
    const event = unsavedModificationsPresent ? 'userChanged' : 'userUpdated';
    $broadcast(event);
  }

  return (
    <form name="userFormLocation" onSubmit={onSubmit} autoComplete="off">
      <div className="panel panel-default">
        <div className="panel-heading">Locations</div>
        <div className="panel-body">
          <div className="form-horizontal">
            <div className="form-group">
              <label
                htmlFor="location-living"
                className="col-sm-3 text-right control-label"
              >
                {t('Where do you live')}
              </label>
              <div className="col-sm-9 col-md-7 col-lg-6">
                <LocationTypeahead
                  id="location-living"
                  name="locationLiving"
                  initValue={initLocationLiving || ''}
                  onInputChange={onInputChangeLocationLiving}
                  key={initLocationLiving}
                />
              </div>
            </div>

            <div className="form-group">
              <label
                htmlFor="location-from"
                className="col-sm-3 text-right control-label"
              >
                {t('Where are you from')}
              </label>
              <div className="col-sm-9 col-md-7 col-lg-6">
                <LocationTypeahead
                  id="location-from"
                  name="locationFrom"
                  initValue={initLocationFrom || ''}
                  onInputChange={onInputChangeLocationFrom}
                  key={initLocationFrom}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <p>
        <button
          type="submit"
          className="btn btn-lg btn-primary profile-editor-save"
          disabled={!unsavedModifications}
        >
          {t('Save')}
        </button>
        <br />
        <br />
      </p>
    </form>
  );
}

LocationsPanel.propTypes = {
  username: PropTypes.string.isRequired,
  successMessageCallback: PropTypes.func.isRequired,
  errorMessageCallback: PropTypes.func.isRequired,
};
