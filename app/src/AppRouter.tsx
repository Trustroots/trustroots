
import SearchPage from "./pages/Search";
import { Routes, Route } from "react-router-dom";
import HomeLayout from './HomeLayout'
import Profile from './pages/Profile'


const Router = () => { 
  return (
    <Routes>
     <Route element={<HomeLayout />}>
        {/* <Route index element={< />} /> */}
        <Route path="search" element={<SearchPage />}>
        <Route path="profile">
          <Route path=":userId" element={<Profile />} />
        </Route>
        </Route>
      </Route>
    </Routes>
  );
}

export default Router;
