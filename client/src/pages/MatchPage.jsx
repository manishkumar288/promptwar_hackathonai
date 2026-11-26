import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { createTransfer, fetchHospitals, fetchMatch } from '../api.js';
import RiskBadge from '../components/RiskBadge.jsx';
import HospitalMap from '../components/HospitalMap.jsx';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function MatchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const hospitalId = Number(searchParams.get('hospitalId') || 1);
  const group = searchParams.get('group') || 'O-';

  const [hospitals, setHospitals] = useState([]);
  const [matchData, setMatchData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [unitsByDonor, setUnitsByDonor] = useState({});
  const [hoveredDonorId, setHoveredDonorId] = useState(null);
  const [requestBusyId, setRequestBusyId] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [hList, mData] = await Promise.all([
        fetchHospitals(),
        fetchMatch(hospitalId, group),
      ]);
      setHospitals(hList);
      setMatchData(mData);

      const defaults = {};
      for (const d of mData.donors) {
        defaults[d.hospitalId] = d.transferable;
      }
      setUnitsByDonor(defaults);
    } catch (err) {
      setError(err.message || 'Failed to load donor matches');
    } finally {
      setLoading(false);
    }
  }, [hospitalId, group]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function updateSelection(nextHospitalId, nextGroup) {
    setFeedback(null);
    setSearchParams({
      hospitalId: String(nextHospitalId),
      group: nextGroup,
    });
  }

  async function handleRequestTransfer(donor) {
    const units = Number(unitsByDonor[donor.hospitalId] ?? donor.transferable);
    try {
      setRequestBusyId(donor.hospitalId);
      setFeedback(null);
      const created = await createTransfer({
        fromHospitalId: donor.hospitalId,
        toHospitalId: hospitalId,
        bloodGroup: group,
        units,
      });
      setFeedback({
        ok: true,
        text: `Transfer #${created.id} requested: ${units} units of ${group} from ${donor.name}.`,
      });
    } catch (err) {
      setFeedback({ ok: false, text: err.message });
    } finally {
      setRequestBusyId(null);
    }
  }

  const mapHospitals = useMemo(() => {
    if (!matchData) return [];
    const donorById = new Map(matchData.donors.map((d) => [d.hospitalId, d]));
    const { shortage } = matchData;

    return hospitals.map((h) => {
      if (h.id === shortage.hospitalId) {
        return {
          id: h.id,
          name: h.name,
          lat: h.lat,
          lng: h.lng,
          riskLevel: shortage.riskLevel,
          label: `Shortage: needs ${shortage.neededUnits} units`,
        };
      }
      const donor = donorById.get(h.id);
      if (donor) {
        return {
          id: h.id,
          name: h.name,
          lat: h.lat,
          lng: h.lng,
          riskLevel: 'SAFE',
          label: `${donor.distanceKm} km, can send ${donor.transferable} units`,
        };
      }
      return {
        id: h.id,
        name: h.name,
        lat: h.lat,
        lng: h.lng,
        riskLevel: 'PLAIN',
        label: `No ${group} surplus`,
      };
    });
  }, [hospitals, matchData, group]);

  const mapLines = useMemo(() => {
    if (!matchData) return [];
    const { shortage, donors } = matchData;
    return donors.slice(0, 3).map((d, idx) => ({
      from: [d.lat, d.lng],
      to: [shortage.lat, shortage.lng],
      best: idx === 0,
    }));
  }, [matchData]);

  return (
    <div className="stack">
      <div className="page-bar">
        <div>
          <h1>Donor Matching</h1>
          <p className="muted">
            Ranks nearby hospitals (≤ 50 km) with surplus stock, prioritizing expiring units to cut waste.
          </p>
        </div>
        <Link to="/transfers" className="btn btn-secondary">
          View Transfers
        </Link>
      </div>

      <section className="card">
        <div className="form-grid">
          <label>
            Receiving Hospital
            <select
              value={hospitalId}
              onChange={(e) => updateSelection(Number(e.target.value), group)}
            >
              {hospitals.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.id}. {h.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Blood Group Needed
            <select
              value={group}
              onChange={(e) => updateSelection(hospitalId, e.target.value)}
            >
              {BLOOD_GROUPS.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {loading && (
        <div className="card">
          <p>Finding best donor matches...</p>
        </div>
      )}

      {error && (
        <div className="card status-error">
          <p>Error: {error}</p>
        </div>
      )}

      {feedback && (
        <div className={feedback.ok ? 'status-ok' : 'status-error'}>
          {feedback.text}{' '}
          {feedback.ok && <Link to="/transfers">Go to Transfers →</Link>}
        </div>
      )}

      {!loading && !error && matchData && (
        <>
          <section className="card">
            <div className="section-header">
              <div>
                <h2>
                  Target: {matchData.shortage.name} ({matchData.shortage.group})
                </h2>
                <p className="muted">
                  Current stock: {matchData.shortage.usableUnits} u · Demand: {matchData.shortage.demandPerDay} u/day · Needed (5d target): {matchData.shortage.neededUnits} u
                </p>
              </div>
              <RiskBadge level={matchData.shortage.riskLevel} />
            </div>
          </section>

          <div className="match-layout">
            <section className="card">
              <h2>Ranked Donors ({matchData.donors.length})</h2>
              {matchData.donors.length === 0 ? (
                <p className="muted">
                  No donor hospitals within 50 km currently have surplus {group} units.
                </p>
              ) : (
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Donor Hospital</th>
                        <th>Distance</th>
                        <th>Score</th>
                        <th>Reason</th>
                        <th>Units</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matchData.donors.map((d, idx) => (
                        <tr
                          key={d.hospitalId}
                          className="hover-row"
                          onMouseEnter={() => setHoveredDonorId(d.hospitalId)}
                          onMouseLeave={() => setHoveredDonorId(null)}
                        >
                          <td><strong>#{idx + 1}</strong></td>
                          <td>
                            <Link to={`/hospitals/${d.hospitalId}?group=${encodeURIComponent(group)}`}>
                              {d.name}
                            </Link>
                          </td>
                          <td>{d.distanceKm} km</td>
                          <td>{d.score}</td>
                          <td>{d.reason}</td>
                          <td>
                            <input
                              type="number"
                              className="units-input"
                              min="1"
                              max={d.surplusUnits}
                              value={unitsByDonor[d.hospitalId] ?? d.transferable}
                              onChange={(e) =>
                                setUnitsByDonor((prev) => ({
                                  ...prev,
                                  [d.hospitalId]: e.target.value,
                                }))
                              }
                            />
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-sm"
                              disabled={requestBusyId === d.hospitalId}
                              onClick={() => handleRequestTransfer(d)}
                            >
                              {requestBusyId === d.hospitalId ? 'Requesting...' : 'Request transfer'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="card">
              <h2>Donor Route Map</h2>
              <p className="muted">
                Top 3 donor routes (thickest red line = #1 match). Click any marker for details.
              </p>
              <HospitalMap
                hospitals={mapHospitals}
                highlightId={hospitalId}
                hoverId={hoveredDonorId}
                lines={mapLines}
              />
            </section>
          </div>
        </>
      )}
    </div>
  );
}
