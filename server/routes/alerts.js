import { Router } from 'express';
import db from '../db.js';
import {
  BLOOD_GROUPS,
  EXPIRING_SOON_DAYS,
  daysUntil,
  todayDateString,
} from '../engine/predict.js';
import { getNetworkAssessments, getUsage14 } from './predictions.js';

const router = Router();

const SEVERITY_ORDER = { CRITICAL: 0, HIGH: 1, WATCH: 2 };

function avg(arr) {
  return arr.length ? arr.reduce((sum, x) => sum + x, 0) / arr.length : 0;
}

router.get('/', (req, res) => {
  const today = todayDateString();
  const predictions = getNetworkAssessments(today);
  const hospitals = db.prepare('SELECT id, name FROM hospitals ORDER BY id').all();
  const hospitalNames = Object.fromEntries(hospitals.map((h) => [h.id, h.name]));
  const alerts = [];

  // 1. CRITICAL or HIGH risk for a hospital x blood group
  for (const p of predictions) {
    if (p.riskLevel === 'CRITICAL' || p.riskLevel === 'HIGH') {
      alerts.push({
        id: `risk-${p.hospitalId}-${p.group}`,
        type: 'RISK',
        severity: p.riskLevel,
        hospitalId: p.hospitalId,
        hospitalName: p.hospitalName,
        bloodGroup: p.group,
        message: `${p.hospitalName} is ${p.riskLevel} on ${p.group} (${p.usableUnits} units, stockout day ${p.stockoutDay})`,
      });
    }
  }

  // 2. Batches expiring within 3 days (grouped by hospital x blood group)
  const batchRows = db
    .prepare(
      `SELECT hospital_id, blood_group, units, expiry_date
       FROM inventory_batches
       WHERE units > 0
       ORDER BY expiry_date ASC`
    )
    .all();

  const expiringMap = new Map();
  for (const b of batchRows) {
    const daysLeft = daysUntil(b.expiry_date, today);
    if (daysLeft >= 0 && daysLeft <= EXPIRING_SOON_DAYS) {
      const key = `${b.hospital_id}:${b.blood_group}`;
      const existing = expiringMap.get(key) || {
        hospitalId: b.hospital_id,
        bloodGroup: b.blood_group,
        units: 0,
        minDaysLeft: daysLeft,
      };
      existing.units += b.units;
      existing.minDaysLeft = Math.min(existing.minDaysLeft, daysLeft);
      expiringMap.set(key, existing);
    }
  }

  for (const item of expiringMap.values()) {
    const hName = hospitalNames[item.hospitalId] || `Hospital ${item.hospitalId}`;
    alerts.push({
      id: `expiry-${item.hospitalId}-${item.bloodGroup}`,
      type: 'EXPIRY',
      severity: item.minDaysLeft <= 1 ? 'HIGH' : 'WATCH',
      hospitalId: item.hospitalId,
      hospitalName: hName,
      bloodGroup: item.bloodGroup,
      message: `${item.units} units of ${item.bloodGroup} at ${hName} expire within ${item.minDaysLeft} day(s)`,
    });
  }

  // 3. Demand surge: avg(last 3) > 1.5 x avg(last 14)
  for (const h of hospitals) {
    for (const group of BLOOD_GROUPS) {
      const usage14 = getUsage14(h.id, group).map((r) => r.units_used);
      if (usage14.length < 3) continue;
      const avg3 = avg(usage14.slice(-3));
      const avg14 = avg(usage14);
      if (avg14 > 0 && avg3 > 1.5 * avg14) {
        alerts.push({
          id: `surge-${h.id}-${group}`,
          type: 'SURGE',
          severity: 'HIGH',
          hospitalId: h.id,
          hospitalName: h.name,
          bloodGroup: group,
          message: `Demand surge for ${group} at ${h.name}: 3-day avg ${avg3.toFixed(1)}/day vs 14-day avg ${avg14.toFixed(1)}/day`,
        });
      }
    }
  }

  // 4. Transfer requests still pending
  const pendingTransfers = db
    .prepare(
      `SELECT t.id, t.from_hospital_id, t.to_hospital_id, t.blood_group, t.units,
              fh.name AS from_name, th.name AS to_name
       FROM transfer_requests t
       JOIN hospitals fh ON fh.id = t.from_hospital_id
       JOIN hospitals th ON th.id = t.to_hospital_id
       WHERE t.status = 'pending'
       ORDER BY t.created_at DESC`
    )
    .all();

  for (const t of pendingTransfers) {
    alerts.push({
      id: `transfer-${t.id}`,
      type: 'TRANSFER',
      severity: 'WATCH',
      hospitalId: t.to_hospital_id,
      hospitalName: t.to_name,
      bloodGroup: t.blood_group,
      transferId: t.id,
      message: `Pending transfer #${t.id}: ${t.units} units of ${t.blood_group} from ${t.from_name} to ${t.to_name}`,
    });
  }

  alerts.sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9));
  res.json(alerts);
});

export default router;
