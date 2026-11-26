import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchTransfers, updateTransferStatus } from '../api.js';

const STATUS_CLASS = {
  pending: 'risk-watch',
  approved: 'status-approved',
  completed: 'risk-safe',
  rejected: 'risk-critical',
};

export default function TransfersPage() {
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const loadTransfers = useCallback(async ({ isInitial = false } = {}) => {
    try {
      if (isInitial) setLoading(true);
      setError(null);
      const rows = await fetchTransfers();
      setTransfers(rows);
    } catch (err) {
      setError(err.message || 'Failed to load transfers');
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTransfers({ isInitial: true });
  }, [loadTransfers]);

  async function handleAction(transfer, status) {
    try {
      setBusyId(transfer.id);
      setFeedback(null);
      const res = await updateTransferStatus(transfer.id, status);
      if (status === 'completed') {
        const batchCount = res.transferredBatches?.length || 1;
        setFeedback({
          ok: true,
          text: `Transfer #${transfer.id} completed: moved ${transfer.units} units of ${transfer.blood_group} across ${batchCount} batch(es) preserving original expiry dates.`,
        });
      } else {
        setFeedback({
          ok: true,
          text: `Transfer #${transfer.id} marked as ${status}.`,
        });
      }
      await loadTransfers();
    } catch (err) {
      setFeedback({ ok: false, text: err.message });
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="card">
        <p>Loading transfer requests...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card status-error">
        <p>Error: {error}</p>
        <button type="button" className="btn" onClick={() => loadTransfers({ isInitial: true })}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="page-bar">
        <div>
          <h1>Transfer Requests</h1>
          <p className="muted">
            Approving reserves a request; completing deducts FEFO from the donor and preserves expiry dates at the receiver.
          </p>
        </div>
        <Link to="/match" className="btn">
          + New Donor Match
        </Link>
      </div>

      {feedback && (
        <div className={feedback.ok ? 'status-ok' : 'status-error'}>
          {feedback.text}
        </div>
      )}

      <section className="card">
        {transfers.length === 0 ? (
          <p className="muted">No transfer requests yet.</p>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>From (Donor)</th>
                  <th>To (Receiver)</th>
                  <th>Group</th>
                  <th>Units</th>
                  <th>Status</th>
                  <th>Requested</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((t) => (
                  <tr key={t.id}>
                    <td>#{t.id}</td>
                    <td>
                      <Link to={`/hospitals/${t.from_hospital_id}?group=${encodeURIComponent(t.blood_group)}`}>
                        {t.from_hospital_name}
                      </Link>
                    </td>
                    <td>
                      <Link to={`/hospitals/${t.to_hospital_id}?group=${encodeURIComponent(t.blood_group)}`}>
                        {t.to_hospital_name}
                      </Link>
                    </td>
                    <td><strong>{t.blood_group}</strong></td>
                    <td>{t.units} u</td>
                    <td>
                      <span className={`risk-badge ${STATUS_CLASS[t.status] || 'risk-safe'}`}>
                        {t.status.toUpperCase()}
                      </span>
                    </td>
                    <td>{t.created_at}</td>
                    <td>
                      <div className="action-row">
                        {t.status === 'pending' && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            disabled={busyId === t.id}
                            onClick={() => handleAction(t, 'approved')}
                          >
                            Approve
                          </button>
                        )}
                        {(t.status === 'pending' || t.status === 'approved') && (
                          <>
                            <button
                              type="button"
                              className="btn btn-sm"
                              disabled={busyId === t.id}
                              onClick={() => handleAction(t, 'completed')}
                            >
                              Complete
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              disabled={busyId === t.id}
                              onClick={() => handleAction(t, 'rejected')}
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {(t.status === 'completed' || t.status === 'rejected') && (
                          <span className="muted">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
