import { Router } from 'express';
import db from '../db.js';
import { daysUntil, todayDateString } from '../engine/predict.js';

const router = Router();

// Tracks batch IDs explicitly offered to the network (cleared on demo reset)
const offeredBatchIds = new Set();

export function clearOfferedBatches() {
  offeredBatchIds.clear();
}

export function getOfferedHospitalGroups(today = todayDateString()) {
  if (offeredBatchIds.size === 0) return new Set();
  const rows = db
    .prepare('SELECT id, hospital_id, blood_group, units, expiry_date FROM inventory_batches WHERE units > 0')
    .all();

  const keys = new Set();
  for (const row of rows) {
    if (offeredBatchIds.has(row.id) && daysUntil(row.expiry_date, today) >= 0) {
      keys.add(`${row.hospital_id}:${row.blood_group}`);
    }
  }
  return keys;
}

router.get('/', (req, res) => {
  const days = Number(req.query.days ?? 7);
  if (!Number.isFinite(days) || days < 0) {
    return res.status(400).json({ error: 'days must be a non-negative number' });
  }

  const today = todayDateString();
  const rows = db
    .prepare(
      `SELECT b.*, h.name AS hospital_name, h.phone AS hospital_phone
       FROM inventory_batches b
       JOIN hospitals h ON h.id = b.hospital_id
       WHERE b.units > 0
       ORDER BY h.id ASC, b.expiry_date ASC, b.id ASC`
    )
    .all();

  const groupMap = new Map();
  for (const row of rows) {
    const daysLeft = daysUntil(row.expiry_date, today);
    if (daysLeft < 0 || daysLeft > days) continue;

    if (!groupMap.has(row.hospital_id)) {
      groupMap.set(row.hospital_id, {
        hospitalId: row.hospital_id,
        hospitalName: row.hospital_name,
        phone: row.hospital_phone,
        totalExpiringUnits: 0,
        batches: [],
      });
    }

    const entry = groupMap.get(row.hospital_id);
    entry.totalExpiringUnits += row.units;
    entry.batches.push({
      id: row.id,
      hospital_id: row.hospital_id,
      blood_group: row.blood_group,
      units: row.units,
      collected_date: row.collected_date,
      expiry_date: row.expiry_date,
      daysLeft,
      offered: offeredBatchIds.has(row.id),
    });
  }

  res.json({
    days,
    hospitals: Array.from(groupMap.values()),
  });
});

router.post('/:id/use', (req, res) => {
  const batchId = Number(req.params.id);
  if (!Number.isInteger(batchId) || batchId <= 0) {
    return res.status(400).json({ error: 'Invalid batch ID' });
  }

  const batch = db.prepare('SELECT * FROM inventory_batches WHERE id = ?').get(batchId);
  if (!batch || batch.units <= 0) {
    return res.status(404).json({ error: 'Active batch not found' });
  }

  const today = todayDateString();
  const markUsedTx = db.transaction(() => {
    db.prepare('UPDATE inventory_batches SET units = 0 WHERE id = ?').run(batchId);
    db.prepare(
      `INSERT INTO daily_usage (hospital_id, blood_group, usage_date, units_used)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(hospital_id, blood_group, usage_date)
       DO UPDATE SET units_used = units_used + excluded.units_used`
    ).run(batch.hospital_id, batch.blood_group, today, batch.units);
  });

  markUsedTx();
  offeredBatchIds.delete(batchId);

  res.json({
    ok: true,
    batchId,
    unitsDeducted: batch.units,
    bloodGroup: batch.blood_group,
    hospitalId: batch.hospital_id,
  });
});

router.post('/:id/offer', (req, res) => {
  const batchId = Number(req.params.id);
  if (!Number.isInteger(batchId) || batchId <= 0) {
    return res.status(400).json({ error: 'Invalid batch ID' });
  }

  const batch = db.prepare('SELECT id, units FROM inventory_batches WHERE id = ?').get(batchId);
  if (!batch || batch.units <= 0) {
    return res.status(404).json({ error: 'Active batch not found' });
  }

  const offered = req.body?.offered !== undefined ? Boolean(req.body.offered) : !offeredBatchIds.has(batchId);
  if (offered) {
    offeredBatchIds.add(batchId);
  } else {
    offeredBatchIds.delete(batchId);
  }

  res.json({ ok: true, batchId, offered });
});

export default router;
