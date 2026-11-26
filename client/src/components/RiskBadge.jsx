const RISK_CLASS = {
  CRITICAL: 'risk-critical',
  HIGH: 'risk-high',
  WATCH: 'risk-watch',
  SAFE: 'risk-safe',
};

export default function RiskBadge({ level }) {
  const cls = RISK_CLASS[level] || 'risk-safe';
  return <span className={`risk-badge ${cls}`}>{level}</span>;
}
