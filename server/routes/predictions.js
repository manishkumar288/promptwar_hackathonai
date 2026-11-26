import { Router } from 'express';
import db from '../db.js';
import { BLOOD_GROUPS, assess, daysUntil, todayDateString } from '../engine/predict.js';

const router = Router();

export function getUsage14(hospitalId, group) {
  const rows = db
    .prepare(
      `SELECT usage_date, units_used FROM (
         SELECT usage_date, units_used
         FROM daily_usage
         WHERE hospital_id = ? AND blood_group = ?
         ORDER BY usage_date DESC
         LIMIT 14
       ) ORDER BY usage_date ASC`
    )
    .all(hospitalId, group);
  return rows;
}

export function getHospitalAssessments(hospitalId, today = todayDateString()) {
  const batchesStmt = db.prepare(
    `SELECT id, hospital_id, blood_group, units, collected_date, expiry_date
     FROM inventory_batches
     WHERE hospital_id = ? AND blood_group = ? AND units > 0
     ORDER BY expiry_date ASC`
  );

  return BLOOD_GROUPS.map((group) => {
    const rawBatches = batchesStmt.all(hospitalId, group);
    const batches = rawBatches.map((b) => ({
      units: b.units,
      daysLeft: daysUntil(b.expiry_date, today),
    }));
    const usageRows = getUsage14(hospitalId, group);
    const usage14 = usageRows.map((r) => r.units_used);
    return assess({ group, batches, usage14 });
  });
}

export function getNetworkAssessments(today = todayDateString()) {
  const hospitals = db
    .prepare('SELECT id, name, lat, lng, phone FROM hospitals ORDER BY id')
    .all();

  const results = [];
  for (const h of hospitals) {
    const assessments = getHospitalAssessments(h.id, today);
    for (const a of assessments) {
      results.push({
        hospitalId: h.id,
        hospitalName: h.name,
        lat: h.lat,
        lng: h.lng,
        ...a,
      });
    }
  }
  return results;
}

router.get('/', (req, res) => {
  res.json(getNetworkAssessments());
});

export default router;
