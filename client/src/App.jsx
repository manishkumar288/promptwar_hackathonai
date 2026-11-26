import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage.jsx';
import HospitalPage from './pages/HospitalPage.jsx';

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
            </nav>
          </div>
        </header>

        <main className="main-container">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/hospitals/:id" element={<HospitalPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
