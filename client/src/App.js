import React, { useState, useEffect } from 'react';

import axios from 'axios';

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    (async () => {
      let data
      try {
        ({ data } = await axios.get('/api/users/1'));
      } catch (e) {
        ({ data } = e.response);
      } finally {
        console.log('data', data);
        setUser(data);
      }
    })();
  }, []);

  return (
    <div>app, users {JSON.stringify(user)}</div>
  );
}

export default App;
