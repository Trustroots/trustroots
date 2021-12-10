import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

import TribesHeader from './TribesHeader';
import TribesList from './TribesList';
import TribesJoinTrustroots from './TribesJoinTrustroots';

import * as api from '../api/tribes.api';

export default function TribesPage({ user, onMembershipUpdated }) {
  const [tribes, setTribes] = useState([]);

  const handleMembershipUpdated = data => {
    // update the tribes in state

    /**
     * When user's membership in a tribe changes
     * replace the tribe in react state with the new tribe returned by API
     * and update the state with a new array of tribes.
     * @TODO extract the mapReplace method to be reusable
     * https://github.com/Trustroots/trustroots/pull/1145#discussion_r368321566
     */
    setTribes(tribes =>
      tribes.map(tribe => (tribe._id === data.tribe._id ? data.tribe : tribe)),
    );

    onMembershipUpdated(data);
  };

  const fetchData = async () => {
    const tribes = await api.read();
    setTribes(tribes);
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <>
      <TribesHeader isLoggedIn={!!user} />

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
    </>
  );
}

TribesPage.propTypes = {
  user: PropTypes.object,
  onMembershipUpdated: PropTypes.func.isRequired,
};
