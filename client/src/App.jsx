import { useState } from 'react';
import { BrowserRouter, Link, NavLink, Route, Routes } from 'react-router-dom';
import { resetDemoData } from './api.js';
import DashboardPage from './pages/DashboardPage.jsx';
import HospitalPage from './pages/HospitalPage.jsx';
import MatchPage from './pages/MatchPage.jsx';
import TransfersPage from './pages/TransfersPage.jsx';
import ExpiryPage from './pages/ExpiryPage.jsx';

function navClass({ isActive }) {
  return isActive ? 'nav-link active' : 'nav-link';
}

export default function App() {
  const [resetVersion, setResetVersion] = useState(0);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetFeedback, setResetFeedback] = useState(null);

  async function handleResetDemo() {
    if (!window.confirm('Reset all demo data (inventory, usage, surges, transfers) to the initial seeded state?')) {
      return;
    }
    try {
      setResetBusy(true);
      setResetFeedback(null);
      await resetDemoData();
      setResetVersion((v) => v + 1);
      setResetFeedback({ ok: true, text: 'Demo data reset to initial state.' });
    } catch (err) {
      setResetFeedback({ ok: false, text: err.message || 'Failed to reset demo data' });
    } finally {
      setResetBusy(false);
    }
  }

  return (
    <BrowserRouter>
      <div className="app-shell">
        <header className="topbar">
          <div className="topbar-inner">
            <Link to="/" className="brand">
              <span className="brand-dot" />
              BloodBridge AI
            </Link>
            <nav className="nav-links" aria-label="Main navigation">
              <NavLink to="/" end className={navClass}>Dashboard</NavLink>
              <NavLink to="/match" className={navClass}>Match</NavLink>
              <NavLink to="/expiring" className={navClass}>Expiry</NavLink>
              <NavLink to="/transfers" className={navClass}>Transfers</NavLink>
            </nav>
          </div>
        </header>

        <main className="main-container">
          <Routes key={resetVersion}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/hospitals/:id" element={<HospitalPage />} />
            <Route path="/match" element={<MatchPage />} />
            <Route path="/transfers" element={<TransfersPage />} />
            <Route path="/expiring" element={<ExpiryPage />} />
          </Routes>
        </main>

        <footer className="app-footer">
          <div className="footer-inner">
            <span className="muted">BloodBridge AI · Regional Blood Inventory & Shortage Network</span>
            <div className="action-row">
              {resetFeedback && (
                <span className={resetFeedback.ok ? 'footer-msg-ok' : 'footer-msg-err'}>
                  {resetFeedback.text}
                </span>
              )}
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={resetBusy}
                onClick={handleResetDemo}
              >
                {resetBusy ? 'Resetting...' : 'Reset demo data'}
              </button>
            </div>
          </div>
        </footer>
      </div>
    </BrowserRouter>
  );
}
