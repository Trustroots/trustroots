import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

import TribesHeader from './TribesHeader';
import TribesList from './TribesList';
import TribesJoinTrustroots from './TribesJoinTrustroots';

import * as api from '../api/tribes.api';

export default function TribesPage({ user, onDisplayPhoto, onHidePhoto, onMembershipUpdated }) {
  const [tribes, setTribes] = useState([]);

  const handleMembershipUpdated = data => {
    // update the tribes in state

    setTribes(tribes => tribes.map(tribe => tribe._id === data.tribe._id ? data.tribe : tribe));

    onMembershipUpdated(data);
  };

  const fetchData = async () => {
    const tribes = await api.read();
    setTribes(tribes);
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (<>
    <TribesHeader isLoggedIn={!!user} onDisplayPhoto={onDisplayPhoto} onHidePhoto={onHidePhoto} />

    <section className="container container-spacer">
      <div className="row">
        <div className="col-xs-12">

          <TribesList
            tribes={tribes}
            user={user}
            onMembershipUpdated={handleMembershipUpdated}
          />

        </div>
      </div>

      {!user && <TribesJoinTrustroots />}

    </section>
  </>);
}

TribesPage.propTypes = {
  user: PropTypes.object,
  onMembershipUpdated: PropTypes.func.isRequired,
  onDisplayPhoto: PropTypes.func,
  onHidePhoto: PropTypes.func,
};
