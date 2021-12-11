
import SearchPage from "./pages/Search";
import { Routes, Route } from "react-router-dom";
import HomeLayout from './HomeLayout'




const Router = () => { 
  return (
    <Routes>
     <Route element={<HomeLayout />}>
        {/* <Route index element={< />} /> */}
        <Route path="search" element={<SearchPage />}>
        {/* <Route path=":teamId" element={<Team />} /> */}
        {/* <Route path=":teamId/edit" element={<EditTeam />} /> */}
        {/* <Route path="new" element={<NewTeamForm />} /> */}
        </Route>
    </Route>
    {/* <Route element={<PageLayout />}>
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/tos" element={<Tos />} />
    </Route> */}
    {/* <Route path="contact-us" element={<Contact />} /> */}
    </Routes>
  );
}

export default Router;
