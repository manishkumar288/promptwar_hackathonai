import { Router } from 'express';
import db from '../db.js';
import { BLOOD_GROUPS, todayDateString } from '../engine/predict.js';
import { getNetworkAssessments } from './predictions.js';

const router = Router();

router.get('/summary', (req, res) => {
  const today = todayDateString();
  const predictions = getNetworkAssessments(today);

  let totalUsableUnits = 0;
  let criticalCount = 0;
  let highCount = 0;
  let watchCount = 0;
  let expiringSoonUnits = 0;
  let totalDemandPerDay = 0;

  const groupMap = new Map(
    BLOOD_GROUPS.map((group) => [
      group,
      {
        group,
        totalUsableUnits: 0,
        totalDemandPerDay: 0,
        expiringSoonUnits: 0,
        wastedUnits: 0,
      },
    ])
  );

  for (const p of predictions) {
    totalUsableUnits += p.usableUnits;
    expiringSoonUnits += p.expiringSoon;
    totalDemandPerDay += p.demandPerDay;

    if (p.riskLevel === 'CRITICAL') criticalCount++;
    else if (p.riskLevel === 'HIGH') highCount++;
    else if (p.riskLevel === 'WATCH') watchCount++;

    const g = groupMap.get(p.group);
    g.totalUsableUnits += p.usableUnits;
    g.totalDemandPerDay += p.demandPerDay;
    g.expiringSoonUnits += p.expiringSoon;
    g.wastedUnits += p.wastedUnits;
  }

  const byGroup = Array.from(groupMap.values()).map((g) => ({
    ...g,
    totalDemandPerDay: +g.totalDemandPerDay.toFixed(1),
  }));

  const pendingTransfers = db
    .prepare("SELECT COUNT(*) AS count FROM transfer_requests WHERE status = 'pending'")
    .get().count;

  res.json({
    kpis: {
      totalUsableUnits,
      criticalCount,
      highCount,
      watchCount,
      expiringSoonUnits,
      pendingTransfers,
      totalDemandPerDay: +totalDemandPerDay.toFixed(1),
    },
    byGroup,
  });
});

export default router;
