import { Router } from 'express';
import { BLOOD_GROUPS } from '../engine/predict.js';
import { rankDonors } from '../engine/match.js';
import { getNetworkAssessments } from './predictions.js';
import { getOfferedHospitalGroups } from './expiring.js';

const router = Router();

router.get('/', (req, res) => {
  const hospitalId = Number(req.query.hospitalId);
  const group = req.query.group;

  if (!Number.isInteger(hospitalId) || hospitalId <= 0) {
    return res.status(400).json({ error: 'Valid hospitalId query parameter is required' });
  }
  if (!BLOOD_GROUPS.includes(group)) {
    return res.status(400).json({ error: 'Valid group query parameter is required' });
  }

  const assessments = getNetworkAssessments();
  const offeredKeys = getOfferedHospitalGroups();
  const target = assessments.find((a) => a.hospitalId === hospitalId && a.group === group);
  if (!target) {
    return res.status(404).json({ error: 'Hospital not found' });
  }

  const enrichedCandidates = assessments.map((a) => ({
    ...a,
    offeredToNetwork: offeredKeys.has(`${a.hospitalId}:${a.group}`),
  }));

  const coordMap = new Map();
  for (const a of assessments) {
    if (!coordMap.has(a.hospitalId)) {
      coordMap.set(a.hospitalId, { lat: a.lat, lng: a.lng, name: a.hospitalName });
    }
  }

  const ranked = rankDonors(target, enrichedCandidates).map((d) => {
    const coords = coordMap.get(d.hospitalId) || {};
    return {
      hospitalId: d.hospitalId,
      name: d.hospitalName,
      lat: coords.lat,
      lng: coords.lng,
      group: d.group,
      distanceKm: d.distanceKm,
      surplusUnits: d.surplusUnits,
      transferable: d.transferableUnits,
      expiringSoon: d.expiringSoon,
      offeredToNetwork: d.offeredToNetwork,
      score: d.score,
      reason: d.reason,
    };
  });

  res.json({
    shortage: {
      hospitalId: target.hospitalId,
      name: target.hospitalName,
      lat: target.lat,
      lng: target.lng,
      group: target.group,
      usableUnits: target.usableUnits,
      demandPerDay: target.demandPerDay,
      neededUnits: target.neededUnits,
      stockoutDay: target.stockoutDay,
      riskLevel: target.riskLevel,
    },
    donors: ranked,
  });
});

export default router;
