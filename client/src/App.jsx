import { useEffect, useState } from 'react';
import { fetchHospitals } from './api.js';

export default function App() {
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadHospitals() {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchHospitals();
        if (!cancelled) {
          setHospitals(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Unable to load hospitals');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadHospitals();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="container">
      <header className="header">
        <h1>BloodBridge AI</h1>
        <p className="subtitle">Predictive Emergency Blood Shortage Network</p>
      </header>

      <main className="card">
        <h2>Connected Hospitals</h2>

        {loading && <p>Loading hospitals...</p>}

        {error && <p className="status-error">Error: {error}</p>}

        {!loading && !error && (
          <ul className="hospital-list">
            {hospitals.map((hospital) => (
              <li key={hospital.id} className="hospital-item">
                <span className="hospital-name">{hospital.name}</span>
                <span className="hospital-phone">{hospital.phone}</span>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
