import db from '../db.js';
import { BLOOD_GROUPS, assess, daysUntil, todayDateString } from './predict.js';

const today = todayDateString();

function getAssessmentsForHospital(hospitalId) {
  const batchesStmt = db.prepare(
    'SELECT units, expiry_date FROM inventory_batches WHERE hospital_id = ? AND blood_group = ? AND units > 0'
  );
  const usageStmt = db.prepare(
    `SELECT units_used FROM (
       SELECT usage_date, units_used
       FROM daily_usage
       WHERE hospital_id = ? AND blood_group = ?
       ORDER BY usage_date DESC
       LIMIT 14
     ) ORDER BY usage_date ASC`
  );

  return BLOOD_GROUPS.map((group) => {
    const batches = batchesStmt.all(hospitalId, group).map((b) => ({
      units: b.units,
      daysLeft: daysUntil(b.expiry_date, today),
    }));
    const usage14 = usageStmt.all(hospitalId, group).map((u) => u.units_used);
    return assess({ group, batches, usage14 });
  });
}

const hospital1 = db.prepare('SELECT id, name FROM hospitals WHERE id = 1').get();
if (!hospital1) {
  console.error('Hospital 1 not found. Run `npm run seed` first.');
  process.exit(1);
}

console.log(`Assessments for Hospital ${hospital1.id} (${hospital1.name}) on ${today}:`);
const h1Assessments = getAssessmentsForHospital(1);
console.table(h1Assessments);

const oNeg = h1Assessments.find((a) => a.group === 'O-');
console.log(
  `Hospital 1 O- status: ${oNeg.riskLevel} (score ${oNeg.riskScore}, cover ${oNeg.daysOfCover} days, stockout day ${oNeg.stockoutDay})`
);

if (oNeg.riskLevel !== 'CRITICAL' && oNeg.riskLevel !== 'HIGH') {
  console.error('Expected Hospital 1 O- to be CRITICAL or HIGH!');
  process.exit(1);
}
