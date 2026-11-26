import { Router } from 'express';
import db from '../db.js';
import { BLOOD_GROUPS, daysUntil, todayDateString } from '../engine/predict.js';

const router = Router();

function addDaysToStr(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

router.post('/', (req, res) => {
  const hospitalId = Number(req.body?.hospitalId);
  const bloodGroup = req.body?.bloodGroup || req.body?.group;
  const units = Number(req.body?.units);
  const today = todayDateString();
  const collectedDate = req.body?.collectedDate || today;
  const expiryDate = req.body?.expiryDate || addDaysToStr(collectedDate, 35);

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

  const info = db
    .prepare(
      `INSERT INTO inventory_batches (hospital_id, blood_group, units, collected_date, expiry_date)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(hospitalId, bloodGroup, units, collectedDate, expiryDate);

  const created = db
    .prepare('SELECT * FROM inventory_batches WHERE id = ?')
    .get(info.lastInsertRowid);

  res.status(201).json({
    ...created,
    daysLeft: daysUntil(created.expiry_date, today),
  });
});

export default router;
