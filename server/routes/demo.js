import { Router } from 'express';
import db from '../db.js';
import { BLOOD_GROUPS, todayDateString } from '../engine/predict.js';
import { getUsage14 } from './predictions.js';

const router = Router();

router.post('/surge', (req, res) => {
  const hospitalId = Number(req.body?.hospitalId);
  const group = req.body?.group || req.body?.bloodGroup;
  const multiplier = Number(req.body?.multiplier ?? 80);

  if (!Number.isInteger(hospitalId) || hospitalId <= 0) {
    return res.status(400).json({ error: 'Valid hospitalId is required' });
  }
  if (!BLOOD_GROUPS.includes(group)) {
    return res.status(400).json({ error: 'Valid blood group is required' });
  }
  if (!Number.isFinite(multiplier) || multiplier <= 0) {
    return res.status(400).json({ error: 'multiplier must be a positive number' });
  }

  const hospital = db.prepare('SELECT id FROM hospitals WHERE id = ?').get(hospitalId);
  if (!hospital) {
    return res.status(404).json({ error: 'Hospital not found' });
  }

  const today = todayDateString();
  const usage14 = getUsage14(hospitalId, group).map((r) => r.units_used);
  const baseline = usage14.length
    ? usage14.reduce((sum, u) => sum + u, 0) / usage14.length
    : 2;
  const extraUnits = Math.max(1, Math.round(baseline * multiplier));

  db.prepare(
    `INSERT INTO daily_usage (hospital_id, blood_group, usage_date, units_used)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(hospital_id, blood_group, usage_date)
     DO UPDATE SET units_used = units_used + excluded.units_used`
  ).run(hospitalId, group, today, extraUnits);

  res.json({ ok: true, hospitalId, group, multiplier, extraUnits, usageDate: today });
});

export default router;
