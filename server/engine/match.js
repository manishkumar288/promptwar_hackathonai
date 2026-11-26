export const MAX_DONOR_DISTANCE_KM = 50;
export const MAX_DONOR_RESULTS = 5;

export const MATCH_WEIGHTS = {
  DISTANCE: 0.5,
  TRANSFERABLE: 0.3,
  EXPIRING: 0.2,
};

const EARTH_RADIUS_KM = 6371;

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

export function haversineKm(lat1, lng1, lat2, lng2) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

export function rankDonors(target, candidates) {
  const needed = target.neededUnits || 0;
  const donors = [];

  for (const donor of candidates) {
    if (donor.hospitalId === target.hospitalId) continue;
    if (donor.group !== target.group) continue;
    if (donor.surplusUnits <= 0) continue;

    const distanceKm = haversineKm(target.lat, target.lng, donor.lat, donor.lng);
    if (distanceKm > MAX_DONOR_DISTANCE_KM) continue;

    const transferableUnits =
      needed > 0 ? Math.min(donor.surplusUnits, needed) : donor.surplusUnits;
    const unitRatio = needed > 0 ? Math.min(1, transferableUnits / needed) : 1;
    const hasExpiring = donor.expiringSoon > 0 ? 1 : 0;

    const score =
      MATCH_WEIGHTS.DISTANCE * (1 - distanceKm / MAX_DONOR_DISTANCE_KM) +
      MATCH_WEIGHTS.TRANSFERABLE * unitRatio +
      MATCH_WEIGHTS.EXPIRING * hasExpiring;

    const expiryPart =
      donor.expiringSoon > 0
        ? `, ${donor.expiringSoon} expire within 3 days`
        : '';
    const reason = `${distanceKm.toFixed(1)} km away, can send ${transferableUnits} units${expiryPart}.`;

    donors.push({
      hospitalId: donor.hospitalId,
      hospitalName: donor.hospitalName,
      group: donor.group,
      distanceKm: +distanceKm.toFixed(1),
      surplusUnits: donor.surplusUnits,
      transferableUnits,
      expiringSoon: donor.expiringSoon,
      score: +score.toFixed(3),
      reason,
    });
  }

  donors.sort((a, b) => b.score - a.score);
  return donors.slice(0, MAX_DONOR_RESULTS);
}
