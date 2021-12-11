import { BrowserRouter } from "react-router-dom";
import AppRouter from "./AppRouter";

const App = () => { 
  return (
    <div className="App">
    <BrowserRouter> 
      <AppRouter />
    </BrowserRouter>
    </div>
  );
}

export default App;
