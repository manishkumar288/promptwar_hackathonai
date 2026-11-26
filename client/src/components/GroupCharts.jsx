import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export default function GroupCharts({ byGroup }) {
  if (!byGroup || byGroup.length === 0) return null;

  return (
    <section className="charts-grid">
      <div className="card">
        <h2>Daily Demand by Blood Group</h2>
        <p className="muted">Forecasted network demand (units/day)</p>
        <div className="chart-box">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byGroup} margin={{ top: 10, right: 16, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="group" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="totalDemandPerDay" name="Demand / Day" fill="#dc2626" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h2>Total Usable Units by Blood Group</h2>
        <p className="muted">Non-expired inventory across all 8 hospitals</p>
        <div className="chart-box">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byGroup} margin={{ top: 10, right: 16, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="group" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="totalUsableUnits" name="Usable Units" fill="#16a34a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
