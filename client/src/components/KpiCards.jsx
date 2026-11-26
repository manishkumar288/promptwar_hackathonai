export default function KpiCards({ kpis }) {
  if (!kpis) return null;

  const cards = [
    {
      label: 'Total Usable Units',
      value: kpis.totalUsableUnits,
      sub: `${kpis.totalDemandPerDay} units/day demand`,
      tone: 'neutral',
    },
    {
      label: 'Critical / High Cells',
      value: `${kpis.criticalCount} / ${kpis.highCount}`,
      sub: 'Immediate shortage risk',
      tone: kpis.criticalCount > 0 ? 'critical' : kpis.highCount > 0 ? 'high' : 'safe',
    },
    {
      label: 'Watch Cells',
      value: kpis.watchCount,
      sub: 'Stockout within 5–7 days',
      tone: kpis.watchCount > 0 ? 'watch' : 'safe',
    },
    {
      label: 'Expiring ≤ 3 Days',
      value: `${kpis.expiringSoonUnits} u`,
      sub: 'At risk of waste',
      tone: kpis.expiringSoonUnits > 0 ? 'high' : 'safe',
    },
    {
      label: 'Pending Transfers',
      value: kpis.pendingTransfers,
      sub: 'Awaiting approval/completion',
      tone: kpis.pendingTransfers > 0 ? 'watch' : 'neutral',
    },
  ];

  return (
    <section className="kpi-grid">
      {cards.map((card) => (
        <div key={card.label} className={`kpi-card kpi-${card.tone}`}>
          <div className="kpi-label">{card.label}</div>
          <div className="kpi-value">{card.value}</div>
          <div className="kpi-sub">{card.sub}</div>
        </div>
      ))}
    </section>
  );
}
