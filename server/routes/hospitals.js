import { Router } from 'express';
import db from '../db.js';
import { BLOOD_GROUPS, daysUntil, todayDateString } from '../engine/predict.js';
import { getHospitalAssessments, getUsage14 } from './predictions.js';

const router = Router();

router.get('/', (req, res) => {
  const hospitals = db
    .prepare('SELECT id, name, lat, lng, phone FROM hospitals ORDER BY id')
    .all();
  res.json(hospitals);
});

router.get('/:id', (req, res) => {
  const hospitalId = Number(req.params.id);
  if (!Number.isInteger(hospitalId) || hospitalId <= 0) {
    return res.status(400).json({ error: 'Invalid hospital ID' });
  }

  const hospital = db
    .prepare('SELECT id, name, lat, lng, phone FROM hospitals WHERE id = ?')
    .get(hospitalId);

  if (!hospital) {
    return res.status(404).json({ error: 'Hospital not found' });
  }

  const today = todayDateString();
  const batches = db
    .prepare(
      `SELECT id, hospital_id, blood_group, units, collected_date, expiry_date
       FROM inventory_batches
       WHERE hospital_id = ? AND units > 0
       ORDER BY expiry_date ASC`
    )
    .all(hospitalId)
    .map((b) => ({
      ...b,
      daysLeft: daysUntil(b.expiry_date, today),
    }));

  const assessments = getHospitalAssessments(hospitalId, today);

  const usageByGroup = {};
  for (const group of BLOOD_GROUPS) {
    usageByGroup[group] = getUsage14(hospitalId, group).map((row) => ({
      date: row.usage_date,
      unitsUsed: row.units_used,
    }));
  }

  res.json({
    hospital,
    batches,
    assessments,
    usageByGroup,
  });
});

export default router;
