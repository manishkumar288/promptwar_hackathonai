import { useEffect, useState } from 'react';
import { addBatch, logUsage } from '../api.js';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function plusDaysStr(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function InventoryForms({ hospitalId, selectedGroup, onSuccess }) {
  const [addGroup, setAddGroup] = useState(selectedGroup);
  const [addUnits, setAddUnits] = useState(5);
  const [collectedDate, setCollectedDate] = useState(todayStr);
  const [expiryDate, setExpiryDate] = useState(() => plusDaysStr(35));
  const [addStatus, setAddStatus] = useState(null);
  const [addBusy, setAddBusy] = useState(false);

  const [useGroup, setUseGroup] = useState(selectedGroup);
  const [useUnits, setUseUnits] = useState(2);
  const [useStatus, setUseStatus] = useState(null);
  const [useBusy, setUseBusy] = useState(false);

  useEffect(() => {
    setAddGroup(selectedGroup);
    setUseGroup(selectedGroup);
  }, [selectedGroup]);

  async function handleAddSubmit(e) {
    e.preventDefault();
    try {
      setAddBusy(true);
      setAddStatus(null);
      await addBatch({
        hospitalId,
        bloodGroup: addGroup,
        units: Number(addUnits),
        collectedDate,
        expiryDate,
      });
      setAddStatus({ ok: true, text: `Added ${addUnits} units of ${addGroup}.` });
      await onSuccess();
    } catch (err) {
      setAddStatus({ ok: false, text: err.message });
    } finally {
      setAddBusy(false);
    }
  }

  async function handleUsageSubmit(e) {
    e.preventDefault();
    try {
      setUseBusy(true);
      setUseStatus(null);
      await logUsage({
        hospitalId,
        bloodGroup: useGroup,
        units: Number(useUnits),
      });
      setUseStatus({ ok: true, text: `Logged ${useUnits} units used of ${useGroup} (FEFO).` });
      await onSuccess();
    } catch (err) {
      setUseStatus({ ok: false, text: err.message });
    } finally {
      setUseBusy(false);
    }
  }

  return (
    <section className="charts-grid">
      <form className="card form-card" onSubmit={handleAddSubmit}>
        <h2>Add Stock</h2>
        <p className="muted">Record a newly received blood batch.</p>

        <div className="form-grid">
          <label>
            Blood Group
            <select value={addGroup} onChange={(e) => setAddGroup(e.target.value)}>
              {BLOOD_GROUPS.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </label>
          <label>
            Units
            <input
              type="number"
              min="1"
              max="200"
              value={addUnits}
              onChange={(e) => setAddUnits(e.target.value)}
              required
            />
          </label>
          <label>
            Collected Date
            <input
              type="date"
              value={collectedDate}
              onChange={(e) => setCollectedDate(e.target.value)}
              required
            />
          </label>
          <label>
            Expiry Date
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              required
            />
          </label>
        </div>

        <button type="submit" className="btn" disabled={addBusy}>
          {addBusy ? 'Adding...' : 'Add Stock'}
        </button>

        {addStatus && (
          <p className={addStatus.ok ? 'status-ok' : 'status-error'}>{addStatus.text}</p>
        )}
      </form>

      <form className="card form-card" onSubmit={handleUsageSubmit}>
        <h2>Log Usage (FEFO)</h2>
        <p className="muted">Deducts oldest-expiry-first batches and updates daily usage.</p>

        <div className="form-grid">
          <label>
            Blood Group
            <select value={useGroup} onChange={(e) => setUseGroup(e.target.value)}>
              {BLOOD_GROUPS.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </label>
          <label>
            Units Used
            <input
              type="number"
              min="1"
              max="200"
              value={useUnits}
              onChange={(e) => setUseUnits(e.target.value)}
              required
            />
          </label>
        </div>

        <button type="submit" className="btn btn-secondary" disabled={useBusy}>
          {useBusy ? 'Logging...' : 'Log Usage'}
        </button>

        {useStatus && (
          <p className={useStatus.ok ? 'status-ok' : 'status-error'}>{useStatus.text}</p>
        )}
      </form>
    </section>
  );
}
