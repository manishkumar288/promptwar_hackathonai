import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage.jsx';
import HospitalPage from './pages/HospitalPage.jsx';
import MatchPage from './pages/MatchPage.jsx';
import TransfersPage from './pages/TransfersPage.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <header className="topbar">
          <div className="topbar-inner">
            <Link to="/" className="brand">
              <span className="brand-dot" />
              BloodBridge AI
            </Link>
            <nav className="nav-links">
              <Link to="/">Dashboard</Link>
              <Link to="/match">Donor Match</Link>
              <Link to="/transfers">Transfers</Link>
            </nav>
          </div>
        </header>

        <main className="main-container">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/hospitals/:id" element={<HospitalPage />} />
            <Route path="/match" element={<MatchPage />} />
            <Route path="/transfers" element={<TransfersPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
