import { Router } from 'express';
import db from '../db.js';
import { BLOOD_GROUPS, todayDateString } from '../engine/predict.js';
import { seedDatabase } from '../seed.js';
import { clearOfferedBatches } from './expiring.js';
import { getUsage14 } from './predictions.js';

const router = Router();

const MAX_SURGE_MULTIPLIER = 5;
const TODAY_DEMAND_WEIGHT = 0.6 / 3 + 0.4 / 14;

router.post('/surge', (req, res) => {
  const hospitalId = Number(req.body?.hospitalId);
  const group = req.body?.group || req.body?.bloodGroup;
  const rawMultiplier = Number(req.body?.multiplier ?? 3);

  if (!Number.isInteger(hospitalId) || hospitalId <= 0) {
    return res.status(400).json({ error: 'Valid hospitalId is required' });
  }
  if (!BLOOD_GROUPS.includes(group)) {
    return res.status(400).json({ error: 'Valid blood group is required' });
  }
  if (!Number.isFinite(rawMultiplier) || rawMultiplier <= 0) {
    return res.status(400).json({ error: 'multiplier must be a positive number' });
  }

  const multiplier = Math.min(MAX_SURGE_MULTIPLIER, rawMultiplier);

  const hospital = db.prepare('SELECT id FROM hospitals WHERE id = ?').get(hospitalId);
  if (!hospital) {
    return res.status(404).json({ error: 'Hospital not found' });
  }

  const today = todayDateString();
  const usage14 = getUsage14(hospitalId, group).map((r) => r.units_used);
  const baseline = usage14.length
    ? usage14.reduce((sum, u) => sum + u, 0) / usage14.length
    : 2;
  const extraUnits =
    multiplier > 1
      ? Math.max(1, Math.round((baseline * (multiplier - 1)) / TODAY_DEMAND_WEIGHT))
      : Math.max(1, Math.round(baseline * multiplier));

  db.prepare(
    `INSERT INTO daily_usage (hospital_id, blood_group, usage_date, units_used)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(hospital_id, blood_group, usage_date)
     DO UPDATE SET units_used = units_used + excluded.units_used`
  ).run(hospitalId, group, today, extraUnits);

  res.json({ ok: true, hospitalId, group, multiplier, extraUnits, usageDate: today });
});

router.post('/reset', (req, res) => {
  clearOfferedBatches();
  const counts = seedDatabase();
  res.json({ ok: true, counts });
});

export default router;
