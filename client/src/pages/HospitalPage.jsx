import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchHospital } from '../api.js';
import RiskBadge from '../components/RiskBadge.jsx';

export default function HospitalPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetchHospital(id);
        if (!cancelled) setData(res);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load hospital');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

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
      </div>

      <div className="card">
        <h2>Per-Group Risk Summary</h2>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Group</th>
                <th>Risk Level</th>
                <th>Usable Units</th>
                <th>Demand / Day</th>
                <th>Days Cover</th>
                <th>Stockout Day</th>
              </tr>
            </thead>
            <tbody>
              {data.assessments.map((a) => (
                <tr key={a.group}>
                  <td><strong>{a.group}</strong></td>
                  <td><RiskBadge level={a.riskLevel} /></td>
                  <td>{a.usableUnits}</td>
                  <td>{a.demandPerDay}</td>
                  <td>{a.daysOfCover ?? '—'}</td>
                  <td>{a.stockoutDay ?? 'None'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
