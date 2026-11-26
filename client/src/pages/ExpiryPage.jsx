import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchExpiring,
  markBatchUsed,
  offerBatchToNetwork,
} from '../api.js';

function getExpiryBadge(daysLeft) {
  if (daysLeft <= 3) return { label: `${daysLeft}d left`, cls: 'risk-critical' };
  if (daysLeft <= 7) return { label: `${daysLeft}d left`, cls: 'risk-watch' };
  return { label: `${daysLeft}d left`, cls: 'risk-safe' };
}

export default function ExpiryPage() {
  const [days, setDays] = useState(7);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyBatchId, setBusyBatchId] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const loadExpiring = useCallback(async ({ isInitial = false } = {}) => {
    try {
      if (isInitial) setLoading(true);
      setError(null);
      const data = await fetchExpiring(days);
      setGroups(data.hospitals || []);
    } catch (err) {
      setError(err.message || 'Failed to load expiring batches');
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    loadExpiring({ isInitial: true });
  }, [loadExpiring]);

  async function handleMarkUsed(batch) {
    try {
      setBusyBatchId(batch.id);
      setFeedback(null);
      await markBatchUsed(batch.id);
      setFeedback({
        ok: true,
        text: `Marked batch #${batch.id} (${batch.units} u of ${batch.blood_group}) as used.`,
      });
      await loadExpiring();
    } catch (err) {
      setFeedback({ ok: false, text: err.message });
    } finally {
      setBusyBatchId(null);
    }
  }

  async function handleOffer(batch) {
    try {
      setBusyBatchId(batch.id);
      setFeedback(null);
      const nextOffered = !batch.offered;
      await offerBatchToNetwork(batch.id, nextOffered);
      setFeedback({
        ok: true,
        text: nextOffered
          ? `Batch #${batch.id} (${batch.blood_group}) offered to network — prioritized as a donor boost on /match.`
          : `Removed network offer for batch #${batch.id}.`,
      });
      await loadExpiring();
    } catch (err) {
      setFeedback({ ok: false, text: err.message });
    } finally {
      setBusyBatchId(null);
    }
  }

  if (loading) {
    return (
      <div className="card">
        <p>Loading expiring batches...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card status-error">
        <p>Error: {error}</p>
        <button type="button" className="btn" onClick={() => loadExpiring({ isInitial: true })}>
          Retry
        </button>
      </div>
    );
  }

  const totalBatches = groups.reduce((s, h) => s + h.batches.length, 0);
  const totalUnits = groups.reduce((s, h) => s + h.totalExpiringUnits, 0);

  return (
    <div className="stack">
      <div className="page-bar">
        <div>
          <h1>Expiring Blood Batches</h1>
          <p className="muted">
            {totalUnits} units across {totalBatches} batch(es) expiring within {days} days.
          </p>
        </div>

        <label className="inline-filter">
          Window:
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={3}>Within 3 days</option>
            <option value={7}>Within 7 days</option>
            <option value={14}>Within 14 days</option>
          </select>
        </label>
      </div>

      {feedback && (
        <div className={feedback.ok ? 'status-ok' : 'status-error'}>
          {feedback.text}{' '}
          {feedback.ok && <Link to="/match">Check Donor Match →</Link>}
        </div>
      )}

      {groups.length === 0 ? (
        <div className="card">
          <p className="muted">No active batches expiring within {days} days.</p>
        </div>
      ) : (
        groups.map((h) => (
          <section key={h.hospitalId} className="card">
            <div className="section-header">
              <div>
                <h2>
                  <Link to={`/hospitals/${h.hospitalId}`} className="hospital-link">
                    {h.hospitalName}
                  </Link>
                </h2>
                <p className="muted">
                  Phone: {h.phone} · {h.totalExpiringUnits} units expiring
                </p>
              </div>
            </div>

            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Batch #</th>
                    <th>Group</th>
                    <th>Units</th>
                    <th>Expiry Date</th>
                    <th>Time Left</th>
                    <th>Network Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {h.batches.map((b) => {
                    const badge = getExpiryBadge(b.daysLeft);
                    return (
                      <tr key={b.id}>
                        <td>#{b.id}</td>
                        <td><strong>{b.blood_group}</strong></td>
                        <td>{b.units} u</td>
                        <td>{b.expiry_date}</td>
                        <td>
                          <span className={`risk-badge ${badge.cls}`}>{badge.label}</span>
                        </td>
                        <td>
                          {b.offered ? (
                            <span className="risk-badge offer-badge">OFFERED BOOST</span>
                          ) : (
                            <span className="muted">Local only</span>
                          )}
                        </td>
                        <td>
                          <div className="action-row">
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              disabled={busyBatchId === b.id}
                              onClick={() => handleMarkUsed(b)}
                            >
                              Mark used
                            </button>
                            <button
                              type="button"
                              className={`btn btn-sm ${b.offered ? 'btn-secondary' : ''}`}
                              disabled={busyBatchId === b.id}
                              onClick={() => handleOffer(b)}
                            >
                              {b.offered ? 'Withdraw offer' : 'Offer to network'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}
    </div>
  );
}
