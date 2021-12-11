
import SearchPage from "./pages/Search";
import { Routes, Route } from "react-router-dom";
import HomeLayout from './HomeLayout'
import Profile from './pages/Profile'
import Page404 from './pages/Page404'

const Router = () => { 
  return (
    <Routes>
     <Route element={<HomeLayout />}>
        {/* <Route index element={< />} /> */}
        <Route path="search" element={<SearchPage />}/>
        <Route path="profile/:userId" element={<Profile />}/>
      </Route>
      <Route path="*" element={<Page404 />} />
    </Routes>
  );
}

export default Router;
