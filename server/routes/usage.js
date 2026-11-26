import { Router } from 'express';
import db from '../db.js';
import { BLOOD_GROUPS, todayDateString } from '../engine/predict.js';
import { deductFefo } from '../engine/fefo.js';

const router = Router();

router.post('/', (req, res) => {
  const hospitalId = Number(req.body?.hospitalId);
  const bloodGroup = req.body?.bloodGroup || req.body?.group;
  const units = Number(req.body?.units);
  const today = todayDateString();
  const usageDate = req.body?.usageDate || today;

  if (!Number.isInteger(hospitalId) || hospitalId <= 0) {
    return res.status(400).json({ error: 'Valid hospitalId is required' });
  }
  if (!BLOOD_GROUPS.includes(bloodGroup)) {
    return res.status(400).json({ error: 'Valid bloodGroup is required' });
  }
  if (!Number.isInteger(units) || units <= 0) {
    return res.status(400).json({ error: 'units must be a positive integer' });
  }

  const hospital = db.prepare('SELECT id FROM hospitals WHERE id = ?').get(hospitalId);
  if (!hospital) {
    return res.status(404).json({ error: 'Hospital not found' });
  }

  try {
    const logUsageTx = db.transaction(() => {
      const deductedBatches = deductFefo(hospitalId, bloodGroup, units, today);
      db.prepare(
        `INSERT INTO daily_usage (hospital_id, blood_group, usage_date, units_used)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(hospital_id, blood_group, usage_date)
         DO UPDATE SET units_used = units_used + excluded.units_used`
      ).run(hospitalId, bloodGroup, usageDate, units);
      return deductedBatches;
    });

    const deductedBatches = logUsageTx();
    res.json({ ok: true, hospitalId, bloodGroup, units, usageDate, deductedBatches });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

export default router;
