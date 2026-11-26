import { Link } from 'react-router-dom';
import RiskBadge from './RiskBadge.jsx';

export default function AlertFeed({ alerts }) {
  return (
    <section className="card">
      <div className="section-header">
        <h2>Live Alert Feed ({alerts.length})</h2>
      </div>

      {alerts.length === 0 ? (
        <p className="muted">No active alerts across the network.</p>
      ) : (
        <ul className="alert-list">
          {alerts.map((alert) => (
            <li key={alert.id} className="alert-item">
              <div className="alert-badges">
                <RiskBadge level={alert.severity} />
                <span className="type-pill">{alert.type}</span>
              </div>
              <div className="alert-body">
                <Link to={`/hospitals/${alert.hospitalId}`} className="alert-message">
                  {alert.message}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
