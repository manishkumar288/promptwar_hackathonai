import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { fetchHospital, fetchHospitals, simulateSurge } from '../api.js';
import RiskBadge from '../components/RiskBadge.jsx';
import BatchTable from '../components/BatchTable.jsx';
import ForecastChart from '../components/ForecastChart.jsx';
import InventoryForms from '../components/InventoryForms.jsx';
import HospitalMap from '../components/HospitalMap.jsx';

export default function HospitalPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [allHospitals, setAllHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [surgeBusy, setSurgeBusy] = useState(false);
  const [surgeMessage, setSurgeMessage] = useState(null);
  const [showAllBatches, setShowAllBatches] = useState(false);

  const selectedGroup = searchParams.get('group') || 'O-';

  const loadHospital = useCallback(async ({ isInitial = false } = {}) => {
    try {
      if (isInitial) setLoading(true);
      setError(null);
      const [res, list] = await Promise.all([fetchHospital(id), fetchHospitals()]);
      setData(res);
      setAllHospitals(list);
    } catch (err) {
      setError(err.message || 'Failed to load hospital');
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadHospital({ isInitial: true });
  }, [loadHospital]);

  async function handleSimulateSurge() {
    try {
      setSurgeBusy(true);
      setSurgeMessage(null);
      const res = await simulateSurge({
        hospitalId: Number(id),
        group: selectedGroup,
        multiplier: 80,
      });
      setSurgeMessage({
        ok: true,
        text: `Simulated emergency surge on ${selectedGroup}: +${res.extraUnits} units added to today's demand.`,
      });
      await loadHospital();
    } catch (err) {
      setSurgeMessage({ ok: false, text: `Surge error: ${err.message}` });
    } finally {
      setSurgeBusy(false);
    }
  }

  const activeAssessment =
    data?.assessments.find((a) => a.group === selectedGroup) || data?.assessments[0];

  const mapHospitals = useMemo(() => {
    if (!data || !activeAssessment) return [];
    const currentId = Number(id);
    return allHospitals.map((h) => ({
      id: h.id,
      name: h.name,
      lat: h.lat,
      lng: h.lng,
      riskLevel: h.id === currentId ? activeAssessment.riskLevel : 'PLAIN',
      label: h.id === currentId ? `${activeAssessment.group}: ${activeAssessment.usableUnits}u` : 'Network hospital',
    }));
  }, [allHospitals, data, activeAssessment, id]);

  if (loading) {
    return (
      <div className="card">
        <p>Loading hospital details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card status-error">
        <p>Error: {error}</p>
        <Link to="/">← Back to Dashboard</Link>
      </div>
    );
  }

  if (!data || !activeAssessment) {
    return (
      <div className="card">
        <p className="muted">No hospital data available.</p>
        <Link to="/">← Back to Dashboard</Link>
      </div>
    );
  }

  const groupBatches = data.batches.filter((b) => b.blood_group === activeAssessment.group);
  const groupHistory = data.usageByGroup?.[activeAssessment.group] || [];

  return (
    <div className="stack">
      <div className="page-bar">
        <div>
          <Link to="/" className="back-link">
            ← Back to Dashboard
          </Link>
          <h1>{data.hospital.name}</h1>
          <p className="muted">
            Phone: {data.hospital.phone} · Active batches: {data.batches.length}
          </p>
        </div>

        <div className="action-row">
          <Link
            to={`/match?hospitalId=${id}&group=${encodeURIComponent(activeAssessment.group)}`}
            className="btn btn-secondary"
          >
            Find Donor Match
          </Link>
          <button
            type="button"
            className="btn"
            onClick={handleSimulateSurge}
            disabled={surgeBusy}
          >
            {surgeBusy ? 'Simulating...' : `Simulate Surge (${activeAssessment.group})`}
          </button>
        </div>
      </div>

      {surgeMessage && (
        <div className={surgeMessage.ok ? 'status-ok' : 'status-error'}>
          {surgeMessage.text}
        </div>
      )}

      <section className="card">
        <h2>Select Blood Group</h2>
        <div className="group-tabs">
          {data.assessments.map((a) => (
            <button
              key={a.group}
              type="button"
              className={`group-tab ${a.group === activeAssessment.group ? 'active' : ''}`}
              onClick={() => setSearchParams({ group: a.group })}
            >
              <span>{a.group}</span>
              <RiskBadge level={a.riskLevel} />
            </button>
          ))}
        </div>

        <div className="detail-metrics">
          <div>
            <span className="muted">Risk Level</span>
            <div><RiskBadge level={activeAssessment.riskLevel} /></div>
          </div>
          <div>
            <span className="muted">Risk Score</span>
            <strong>{activeAssessment.riskScore} / 100</strong>
          </div>
          <div>
            <span className="muted">Usable Units</span>
            <strong>{activeAssessment.usableUnits}</strong>
          </div>
          <div>
            <span className="muted">Forecast Demand</span>
            <strong>{activeAssessment.demandPerDay} / day</strong>
          </div>
          <div>
            <span className="muted">Days of Cover</span>
            <strong>{activeAssessment.daysOfCover ?? '∞'}</strong>
          </div>
          <div>
            <span className="muted">Stockout Day</span>
            <strong>{activeAssessment.stockoutDay ? `Day ${activeAssessment.stockoutDay}` : 'None (14d)'}</strong>
          </div>
          <div>
            <span className="muted">Needed (5d target)</span>
            <strong>{activeAssessment.neededUnits} u</strong>
          </div>
        </div>
      </section>

      <div className="charts-grid">
        <ForecastChart
          group={activeAssessment.group}
          usageHistory={groupHistory}
          batches={groupBatches}
          demandPerDay={activeAssessment.demandPerDay}
        />

        <section className="card">
          <h2>Hospital Location</h2>
          <p className="muted">Highlighted marker shows {data.hospital.name}; click another marker to switch.</p>
          <HospitalMap
            hospitals={mapHospitals}
            highlightId={Number(id)}
            onSelect={(hid) => navigate(`/hospitals/${hid}?group=${encodeURIComponent(activeAssessment.group)}`)}
          />
        </section>
      </div>

      <InventoryForms
        hospitalId={Number(id)}
        selectedGroup={activeAssessment.group}
        onSuccess={() => loadHospital()}
      />

      <BatchTable
        batches={data.batches}
        selectedGroup={activeAssessment.group}
        showAll={showAllBatches}
        onToggleFilter={() => setShowAllBatches((v) => !v)}
      />
    </div>
  );
}
