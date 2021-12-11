import Header from "./components/Header";
import Profile from "./pages/Profile";
import Map from "./pages/Search/Map";

const App = () => {
  return (
    <div className="App">
        <Header />
        <Profile />
        {/* <Map onOfferClose={() => {}} onOfferOpen={() => {}} isUserPublic={true} /> */}
    </div>
  );
}

export default App;
