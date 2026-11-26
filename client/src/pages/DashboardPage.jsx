import { useCallback, useEffect, useState } from 'react';
import {
  fetchAlerts,
  fetchAnalyticsSummary,
  fetchPredictions,
} from '../api.js';
import KpiCards from '../components/KpiCards.jsx';
import RiskHeatmap from '../components/RiskHeatmap.jsx';
import AlertFeed from '../components/AlertFeed.jsx';
import GroupCharts from '../components/GroupCharts.jsx';

const POLL_INTERVAL_MS = 10000;

export default function DashboardPage() {
  const [predictions, setPredictions] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadDashboard = useCallback(async ({ isInitial = false } = {}) => {
    try {
      if (isInitial) setLoading(true);
      setError(null);
      const [predsData, alertsData, summaryData] = await Promise.all([
        fetchPredictions(),
        fetchAlerts(),
        fetchAnalyticsSummary(),
      ]);
      setPredictions(predsData);
      setAlerts(alertsData);
      setSummary(summaryData);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard({ isInitial: true });
    const timer = setInterval(() => {
      loadDashboard();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [loadDashboard]);

  if (loading) {
    return (
      <div className="card">
        <p>Loading network predictions and alerts...</p>
      </div>
    );
  }

  if (error && predictions.length === 0) {
    return (
      <div className="card status-error">
        <p>Error: {error}</p>
        <button type="button" className="btn" onClick={() => loadDashboard({ isInitial: true })}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="page-bar">
        <div>
          <h1>Network Risk Dashboard</h1>
          <p className="muted">
            Live 14-day FEFO shortage predictions · Auto-refreshes every 10s
            {lastUpdated ? ` · Updated ${lastUpdated}` : ''}
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => loadDashboard()}>
          Refresh Now
        </button>
      </div>

      {error && <div className="status-error">Refresh warning: {error}</div>}

      <KpiCards kpis={summary?.kpis} />

      <div className="dashboard-main">
        <RiskHeatmap predictions={predictions} />
        <AlertFeed alerts={alerts} />
      </div>

      <GroupCharts byGroup={summary?.byGroup} />
    </div>
  );
}
