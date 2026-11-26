import db from '../db.js';
import { todayDateString } from './predict.js';

/**
 * Deduct `units` from non-expired batches in FEFO order (earliest expiry first).
 * Must be called inside or as a transaction; wraps itself in a transaction.
 * Returns array of { batchId, unitsTaken, collectedDate, expiryDate }.
 */
export function deductFefo(hospitalId, bloodGroup, units, today = todayDateString()) {
  const run = db.transaction(() => {
    const batches = db
      .prepare(
        `SELECT id, units, collected_date, expiry_date
         FROM inventory_batches
         WHERE hospital_id = ? AND blood_group = ? AND units > 0 AND expiry_date >= ?
         ORDER BY expiry_date ASC, id ASC`
      )
      .all(hospitalId, bloodGroup, today);

    const available = batches.reduce((sum, b) => sum + b.units, 0);
    if (available < units) {
      const err = new Error(
        `Insufficient usable ${bloodGroup} units (requested ${units}, available ${available})`
      );
      err.statusCode = 400;
      throw err;
    }

    const updateStmt = db.prepare('UPDATE inventory_batches SET units = units - ? WHERE id = ?');
    let remaining = units;
    const deductedBatches = [];

    for (const batch of batches) {
      if (remaining <= 0) break;
      const take = Math.min(batch.units, remaining);
      updateStmt.run(take, batch.id);
      remaining -= take;
      deductedBatches.push({
        batchId: batch.id,
        unitsTaken: take,
        collectedDate: batch.collected_date,
        expiryDate: batch.expiry_date,
      });
    }

    return deductedBatches;
  });

  return run();
}
