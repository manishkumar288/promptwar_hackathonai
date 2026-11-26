import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';

function buildForecastSeries(usageHistory, batches, demandPerDay) {
  const historyPoints = (usageHistory || []).map((row) => ({
    label: row.date.slice(5),
    historicalUsage: row.unitsUsed,
    projectedDemand: null,
    projectedStock: null,
  }));

  // Simulate 14-day FEFO depletion matching server predict.js
  const active = batches
    .filter((b) => b.daysLeft >= 0 && b.units > 0)
    .map((b) => ({ units: b.units, daysLeft: b.daysLeft }))
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const projectedPoints = [];
  for (let day = 1; day <= 14; day++) {
    let need = demandPerDay;
    for (const batch of active) {
      if (need <= 0) break;
      if (batch.units > 0 && batch.daysLeft >= day) {
        const take = Math.min(batch.units, need);
        batch.units -= take;
        need -= take;
      }
    }
    for (const batch of active) {
      if (batch.units > 0 && batch.daysLeft <= day) {
        batch.units = 0;
      }
    }
    const remainingStock = active.reduce((sum, b) => sum + b.units, 0);
    projectedPoints.push({
      label: `+${day}d`,
      historicalUsage: null,
      projectedDemand: demandPerDay,
      projectedStock: +remainingStock.toFixed(1),
    });
  }

  return { data: [...historyPoints, ...projectedPoints], splitLabel: '+1d' };
}

export default function ForecastChart({ group, usageHistory, batches, demandPerDay }) {
  const { data, splitLabel } = buildForecastSeries(usageHistory, batches, demandPerDay);

  return (
    <section className="card">
      <h2>14-Day Demand & Stock Forecast ({group})</h2>
      <p className="muted">
        Past 14 days of daily usage followed by 14-day projected demand and FEFO stock depletion.
      </p>
      <div className="chart-box">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="label" />
            <YAxis />
            <Tooltip />
            <Legend />
            <ReferenceLine x={splitLabel} stroke="#94a3b8" strokeDasharray="4 4" label="Forecast" />
            <Line
              type="monotone"
              dataKey="historicalUsage"
              name="Historical Usage"
              stroke="#2563eb"
              strokeWidth={2}
              dot={{ r: 2 }}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="projectedDemand"
              name="Projected Demand/Day"
              stroke="#dc2626"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="projectedStock"
              name="Projected Usable Stock"
              stroke="#16a34a"
              strokeWidth={2.5}
              dot={{ r: 2 }}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
