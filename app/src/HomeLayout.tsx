import { Outlet } from "react-router-dom";
import Header from "./components/Header";

const HomeLayout: React.FC = () => {
  return (
    <div className="App">
      <Header />
      <Outlet />
    </div>
  );
};

export default HomeLayout;
