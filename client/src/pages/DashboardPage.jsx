import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchAlerts,
  fetchAnalyticsSummary,
  fetchPredictions,
  fetchTransfers,
} from '../api.js';
import KpiCards from '../components/KpiCards.jsx';
import HospitalMap from '../components/HospitalMap.jsx';
import RiskHeatmap from '../components/RiskHeatmap.jsx';
import AlertFeed from '../components/AlertFeed.jsx';
import GroupCharts from '../components/GroupCharts.jsx';

const POLL_INTERVAL_MS = 10000;
const RISK_RANK = { CRITICAL: 3, HIGH: 2, WATCH: 1, SAFE: 0 };

export default function DashboardPage() {
  const navigate = useNavigate();
  const [predictions, setPredictions] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadDashboard = useCallback(async ({ isInitial = false } = {}) => {
    try {
      if (isInitial) setLoading(true);
      setError(null);
      const [predsData, alertsData, summaryData, transfersData] = await Promise.all([
        fetchPredictions(),
        fetchAlerts(),
        fetchAnalyticsSummary(),
        fetchTransfers(),
      ]);
      setPredictions(predsData);
      setAlerts(alertsData);
      setSummary(summaryData);
      setTransfers(transfersData);
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

  const mapHospitals = useMemo(() => {
    const byHospital = new Map();
    for (const p of predictions) {
      const existing = byHospital.get(p.hospitalId);
      if (!existing) {
        byHospital.set(p.hospitalId, {
          id: p.hospitalId,
          name: p.hospitalName,
          lat: p.lat,
          lng: p.lng,
          riskLevel: p.riskLevel,
          worstGroup: p.group,
          worstUnits: p.usableUnits,
          totalUnits: p.usableUnits,
        });
      } else {
        existing.totalUnits += p.usableUnits;
        if ((RISK_RANK[p.riskLevel] ?? 0) > (RISK_RANK[existing.riskLevel] ?? 0)) {
          existing.riskLevel = p.riskLevel;
          existing.worstGroup = p.group;
          existing.worstUnits = p.usableUnits;
        }
      }
    }
    return Array.from(byHospital.values()).map((h) => ({
      id: h.id,
      name: h.name,
      lat: h.lat,
      lng: h.lng,
      riskLevel: h.riskLevel,
      label:
        h.riskLevel === 'SAFE'
          ? `${h.totalUnits} total units`
          : `${h.worstGroup} ${h.riskLevel} (${h.worstUnits}u)`,
    }));
  }, [predictions]);

  const transferLines = useMemo(
    () =>
      transfers
        .filter((t) => t.status === 'pending' || t.status === 'approved')
        .map((t) => ({
          from: [t.from_lat, t.from_lng],
          to: [t.to_lat, t.to_lng],
          dashed: true,
        })),
    [transfers]
  );

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

      <section className="card">
        <div className="section-header">
          <div>
            <h2>Regional Network Map</h2>
            <p className="muted">
              Colored by worst blood-group risk per hospital · Dashed lines show pending/approved transfers · Click a marker to inspect
            </p>
          </div>
        </div>
        <HospitalMap
          hospitals={mapHospitals}
          lines={transferLines}
          onSelect={(id) => navigate(`/hospitals/${id}`)}
        />
      </section>

      <div className="dashboard-main">
        <RiskHeatmap predictions={predictions} />
        <AlertFeed alerts={alerts} />
      </div>

      <GroupCharts byGroup={summary?.byGroup} />
    </div>
  );
}
