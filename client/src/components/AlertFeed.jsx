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
                {alert.type === 'RISK' && (
                  <Link
                    to={`/match?hospitalId=${alert.hospitalId}&group=${encodeURIComponent(alert.bloodGroup)}`}
                    className="alert-match-link"
                  >
                    Find Match →
                  </Link>
                )}
                {alert.type === 'TRANSFER' && (
                  <Link to="/transfers" className="alert-match-link">
                    Review →
                  </Link>
                )}
              </div>
              <div className="alert-body">
                <Link
                  to={`/hospitals/${alert.hospitalId}?group=${encodeURIComponent(alert.bloodGroup)}`}
                  className="alert-message"
                >
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
