import { Link, useNavigate } from 'react-router-dom';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const CELL_CLASS = {
  CRITICAL: 'cell-critical',
  HIGH: 'cell-high',
  WATCH: 'cell-watch',
  SAFE: 'cell-safe',
};

export default function RiskHeatmap({ predictions }) {
  const navigate = useNavigate();

  // Group predictions by hospital while preserving hospitalId order
  const hospitalMap = new Map();
  for (const p of predictions) {
    if (!hospitalMap.has(p.hospitalId)) {
      hospitalMap.set(p.hospitalId, {
        id: p.hospitalId,
        name: p.hospitalName,
        cells: {},
      });
    }
    hospitalMap.get(p.hospitalId).cells[p.group] = p;
  }
  const hospitals = Array.from(hospitalMap.values());

  return (
    <section className="card">
      <div className="section-header">
        <div>
          <h2>Hospital × Blood Group Risk Heatmap</h2>
          <p className="muted">Click any cell to inspect hospital inventory, forecast, and actions.</p>
        </div>
        <div className="legend">
          <span className="risk-badge risk-critical">CRITICAL</span>
          <span className="risk-badge risk-high">HIGH</span>
          <span className="risk-badge risk-watch">WATCH</span>
          <span className="risk-badge risk-safe">SAFE</span>
        </div>
      </div>

      {hospitals.length === 0 ? (
        <p className="muted">No hospital predictions available.</p>
      ) : (
        <div className="table-scroll">
          <table className="heatmap-table">
          <thead>
            <tr>
              <th>Hospital</th>
              {BLOOD_GROUPS.map((g) => (
                <th key={g}>{g}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hospitals.map((h) => (
              <tr key={h.id}>
                <td className="hospital-col">
                  <Link to={`/hospitals/${h.id}`} className="hospital-link">
                    {h.name}
                  </Link>
                </td>
                {BLOOD_GROUPS.map((g) => {
                  const cell = h.cells[g];
                  if (!cell) return <td key={g}>—</td>;
                  const cls = CELL_CLASS[cell.riskLevel] || 'cell-safe';
                  return (
                    <td key={g} className="heatmap-td">
                      <button
                        type="button"
                        className={`heatmap-cell ${cls}`}
                        onClick={() =>
                          navigate(`/hospitals/${h.id}?group=${encodeURIComponent(g)}`)
                        }
                        title={`${h.name} ${g}: ${cell.riskLevel} | ${cell.usableUnits} units | ${cell.demandPerDay}/day`}
                      >
                        <span className="cell-level">{cell.riskLevel}</span>
                        <span className="cell-meta">
                          {cell.usableUnits}u · {cell.daysOfCover ?? '∞'}d
                        </span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </section>
  );
}
