import React from 'react';

// import axios from 'axios';
import Routes from './Routes';
import Layout from './Layout';

function App() {
  /*
  const [user, setUser] = useState(null);

  useEffect(() => {
    (async () => {
      let data
      try {
        ({ data } = await axios.get('/api/users/me'));
      } catch (e) {
        ({ data } = e.response);
      } finally {
        console.log('data', data);
        setUser(data);
      }
    })();
  }, []);
  */

  return (
    <Layout>
      <Routes />
    </Layout>
  );
}

export default App;
