import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import AuthPage from "./views/authPage";
import './App.css'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<AuthPage />} />
      </Routes>
    </Router>
  );
}

export default App
