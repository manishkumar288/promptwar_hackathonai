import { Router } from 'express';
import db from '../db.js';
import { BLOOD_GROUPS, todayDateString } from '../engine/predict.js';
import { deductFefo } from '../engine/fefo.js';

const router = Router();

const VALID_STATUSES = ['approved', 'completed', 'rejected'];

function fetchTransferById(id) {
  return db
    .prepare(
      `SELECT t.*,
              fh.name AS from_hospital_name, fh.lat AS from_lat, fh.lng AS from_lng,
              th.name AS to_hospital_name, th.lat AS to_lat, th.lng AS to_lng
       FROM transfer_requests t
       JOIN hospitals fh ON fh.id = t.from_hospital_id
       JOIN hospitals th ON th.id = t.to_hospital_id
       WHERE t.id = ?`
    )
    .get(id);
}

router.get('/', (req, res) => {
  const rows = db
    .prepare(
      `SELECT t.*,
              fh.name AS from_hospital_name, fh.lat AS from_lat, fh.lng AS from_lng,
              th.name AS to_hospital_name, th.lat AS to_lat, th.lng AS to_lng
       FROM transfer_requests t
       JOIN hospitals fh ON fh.id = t.from_hospital_id
       JOIN hospitals th ON th.id = t.to_hospital_id
       ORDER BY t.created_at DESC, t.id DESC`
    )
    .all();
  res.json(rows);
});

router.post('/', (req, res) => {
  const fromHospitalId = Number(req.body?.fromHospitalId);
  const toHospitalId = Number(req.body?.toHospitalId);
  const bloodGroup = req.body?.bloodGroup || req.body?.group;
  const units = Number(req.body?.units);

  if (!Number.isInteger(fromHospitalId) || fromHospitalId <= 0) {
    return res.status(400).json({ error: 'Valid fromHospitalId is required' });
  }
  if (!Number.isInteger(toHospitalId) || toHospitalId <= 0) {
    return res.status(400).json({ error: 'Valid toHospitalId is required' });
  }
  if (fromHospitalId === toHospitalId) {
    return res.status(400).json({ error: 'Donor and receiver hospitals must be different' });
  }
  if (!BLOOD_GROUPS.includes(bloodGroup)) {
    return res.status(400).json({ error: 'Valid bloodGroup is required' });
  }
  if (!Number.isInteger(units) || units <= 0) {
    return res.status(400).json({ error: 'units must be a positive integer' });
  }

  const donor = db.prepare('SELECT id FROM hospitals WHERE id = ?').get(fromHospitalId);
  const receiver = db.prepare('SELECT id FROM hospitals WHERE id = ?').get(toHospitalId);
  if (!donor || !receiver) {
    return res.status(404).json({ error: 'Donor or receiver hospital not found' });
  }

  const info = db
    .prepare(
      `INSERT INTO transfer_requests (from_hospital_id, to_hospital_id, blood_group, units, status)
       VALUES (?, ?, ?, ?, 'pending')`
    )
    .run(fromHospitalId, toHospitalId, bloodGroup, units);

  res.status(201).json(fetchTransferById(info.lastInsertRowid));
});

router.patch('/:id', (req, res) => {
  const id = Number(req.params.id);
  const nextStatus = req.body?.status;

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid transfer ID' });
  }
  if (!VALID_STATUSES.includes(nextStatus)) {
    return res.status(400).json({ error: 'status must be approved, completed, or rejected' });
  }

  const transfer = db.prepare('SELECT * FROM transfer_requests WHERE id = ?').get(id);
  if (!transfer) {
    return res.status(404).json({ error: 'Transfer request not found' });
  }

  if (transfer.status === 'completed' || transfer.status === 'rejected') {
    return res.status(400).json({ error: `Transfer is already ${transfer.status}` });
  }

  if (nextStatus !== 'completed') {
    db.prepare('UPDATE transfer_requests SET status = ? WHERE id = ?').run(nextStatus, id);
    return res.json({ transfer: fetchTransferById(id) });
  }

  // Completing a transfer: deduct FEFO from donor, add receiver batch(es) keeping original expiry date
  const today = todayDateString();
  try {
    const completeTx = db.transaction(() => {
      const deductedBatches = deductFefo(
        transfer.from_hospital_id,
        transfer.blood_group,
        transfer.units,
        today
      );

      const insertBatch = db.prepare(
        `INSERT INTO inventory_batches (hospital_id, blood_group, units, collected_date, expiry_date)
         VALUES (?, ?, ?, ?, ?)`
      );

      for (const piece of deductedBatches) {
        insertBatch.run(
          transfer.to_hospital_id,
          transfer.blood_group,
          piece.unitsTaken,
          piece.collectedDate,
          piece.expiryDate
        );
      }

      db.prepare("UPDATE transfer_requests SET status = 'completed' WHERE id = ?").run(id);
      return deductedBatches;
    });

    const deductedBatches = completeTx();
    res.json({ transfer: fetchTransferById(id), transferredBatches: deductedBatches });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

export default router;
