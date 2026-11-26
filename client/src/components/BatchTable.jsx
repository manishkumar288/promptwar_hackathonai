function getExpiryBadge(daysLeft) {
  if (daysLeft < 0) return { label: `EXPIRED (${daysLeft}d)`, cls: 'risk-critical' };
  if (daysLeft <= 3) return { label: `${daysLeft}d left`, cls: 'risk-critical' };
  if (daysLeft <= 7) return { label: `${daysLeft}d left`, cls: 'risk-watch' };
  return { label: `${daysLeft}d left`, cls: 'risk-safe' };
}

export default function BatchTable({ batches, selectedGroup, onToggleFilter, showAll }) {
  const filtered = showAll
    ? batches
    : batches.filter((b) => b.blood_group === selectedGroup);

  return (
    <section className="card">
      <div className="section-header">
        <div>
          <h2>Inventory Batches (FEFO Order)</h2>
          <p className="muted">
            Earliest-expiring units are consumed first. Red ≤ 3 days, Yellow ≤ 7 days.
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={onToggleFilter}>
          {showAll ? `Show Only ${selectedGroup}` : `Show All Groups (${batches.length})`}
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className="muted">No active batches for {selectedGroup}.</p>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Batch #</th>
                <th>Group</th>
                <th>Units</th>
                <th>Collected</th>
                <th>Expiry Date</th>
                <th>Expiry Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => {
                const badge = getExpiryBadge(b.daysLeft);
                return (
                  <tr key={b.id}>
                    <td>#{b.id}</td>
                    <td><strong>{b.blood_group}</strong></td>
                    <td>{b.units}</td>
                    <td>{b.collected_date}</td>
                    <td>{b.expiry_date}</td>
                    <td>
                      <span className={`risk-badge ${badge.cls}`}>{badge.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
