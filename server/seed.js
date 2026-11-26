import { pathToFileURL } from 'node:url';
import db from './db.js';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const HOSPITALS = [
  { id: 1, name: 'Metro General Hospital', lat: 12.9716, lng: 77.5946, phone: '555-0101' },
  { id: 2, name: 'St. Jude Memorial Medical Center', lat: 12.9850, lng: 77.6100, phone: '555-0102' },
  { id: 3, name: 'City Trauma & Emergency Care', lat: 12.9580, lng: 77.5800, phone: '555-0103' },
  { id: 4, name: 'Eastside Community Blood Center', lat: 12.9900, lng: 77.6450, phone: '555-0104' },
  { id: 5, name: 'Northpoint Regional Hospital', lat: 13.0400, lng: 77.5900, phone: '555-0105' },
  { id: 6, name: 'Lakeside Heart & Vascular Institute', lat: 12.9300, lng: 77.6250, phone: '555-0106' },
  { id: 7, name: 'Westgate Surgical Clinic', lat: 12.9650, lng: 77.5200, phone: '555-0107' },
  { id: 8, name: 'Southview Children & Maternity Hospital', lat: 12.9050, lng: 77.5850, phone: '555-0108' },
];

// Average daily usage by blood group: O+, A+, and O- are highest
const BASE_DEMAND = {
  'O+': 3.6,
  'A+': 3.3,
  'O-': 3.0,
  'B+': 2.0,
  'A-': 1.5,
  'AB+': 1.4,
  'B-': 1.2,
  'AB-': 1.0,
};

// Deterministic PRNG so seed data is reproducible across runs and demo resets
function createRng(seed = 20261126) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(baseDate, offsetDays) {
  const d = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + offsetDays);
  return formatDate(d);
}

function buildBatches(hospitalId, group, rng) {
  // Demo condition 1: Hospital 1 low on O- (8 units -> WATCH at ~2.0 units/day, CRITICAL on 3x surge)
  if (hospitalId === 1 && group === 'O-') {
    return [
      { units: 4, daysLeft: 5 },
      { units: 4, daysLeft: 12 },
    ];
  }

  // Demo condition 2: Hospital 4 has surplus O- with some expiring in 2-3 days
  if (hospitalId === 4 && group === 'O-') {
    return [
      { units: 6, daysLeft: 2 },
      { units: 8, daysLeft: 3 },
      { units: 12, daysLeft: 18 },
      { units: 10, daysLeft: 28 },
    ];
  }

  // Demo condition 3: One other hospital is amber (WATCH) on B+ (~5.3 days cover at 3 units/day)
  if (hospitalId === 3 && group === 'B+') {
    return [
      { units: 7, daysLeft: 5 },
      { units: 9, daysLeft: 14 },
    ];
  }

  // Default healthy stock: 2-4 batches, units 2-25, expiry 1-35 days out
  const batchCount = randInt(rng, 2, 4);
  const batches = [];

  // Ensure a few normal cells include near-expiry stock (1-3 days) without causing shortages
  const includeExpiringBatch =
    group !== 'O-' && ((hospitalId + BLOOD_GROUPS.indexOf(group)) % 5 === 0);

  for (let i = 0; i < batchCount; i++) {
    let units;
    let daysLeft;

    if (i === 0 && includeExpiringBatch) {
      units = randInt(rng, 2, 5);
      daysLeft = randInt(rng, 1, 3);
    } else {
      // Keep non-demo cells comfortably above 7 days of cover
      const minUnits = BASE_DEMAND[group] >= 3 ? 14 : 8;
      units = randInt(rng, minUnits, 25);
      const minDays = 10 + i * 5;
      const maxDays = Math.min(35, minDays + 10);
      daysLeft = randInt(rng, minDays, maxDays);
    }

    batches.push({ units, daysLeft });
  }

  return batches;
}

function buildUsageValue(hospitalId, group, dayOffsetFromToday, rng) {
  // Hospital 1 O- baseline ~2.0 units/day -> 8 units = 4 days cover (stockout day 5 = WATCH)
  if (hospitalId === 1 && group === 'O-') {
    return 2;
  }

  // Hospital 4 O- has steady moderate usage (~2.5 units/day) -> strong surplus
  if (hospitalId === 4 && group === 'O-') {
    if (dayOffsetFromToday >= -2) return 2 + (Math.abs(dayOffsetFromToday) % 2);
    return randInt(rng, 2, 3);
  }

  // Hospital 3 B+ has ~3 units/day -> 16 units stocks out on day 6 (WATCH / amber)
  if (hospitalId === 3 && group === 'B+') {
    if (dayOffsetFromToday >= -2) return 3;
    return randInt(rng, 2, 4);
  }

  const base = BASE_DEMAND[group];
  const noise = (rng() - 0.5) * 1.6;
  return Math.max(1, Math.round(base + noise));
}

export function seedDatabase() {
  const rng = createRng();
  const today = new Date();

  const insertHospital = db.prepare(
    'INSERT INTO hospitals (id, name, lat, lng, phone) VALUES (?, ?, ?, ?, ?)'
  );
  const insertBatch = db.prepare(
    'INSERT INTO inventory_batches (hospital_id, blood_group, units, collected_date, expiry_date) VALUES (?, ?, ?, ?, ?)'
  );
  const insertUsage = db.prepare(
    'INSERT INTO daily_usage (hospital_id, blood_group, usage_date, units_used) VALUES (?, ?, ?, ?)'
  );
  const insertTransfer = db.prepare(
    'INSERT INTO transfer_requests (from_hospital_id, to_hospital_id, blood_group, units, status) VALUES (?, ?, ?, ?, ?)'
  );

  const runSeed = db.transaction(() => {
    db.prepare('DELETE FROM transfer_requests').run();
    db.prepare('DELETE FROM daily_usage').run();
    db.prepare('DELETE FROM inventory_batches').run();
    db.prepare('DELETE FROM hospitals').run();

    for (const h of HOSPITALS) {
      insertHospital.run(h.id, h.name, h.lat, h.lng, h.phone);

      for (const group of BLOOD_GROUPS) {
        const batches = buildBatches(h.id, group, rng);
        for (const b of batches) {
          const expiryDate = addDays(today, b.daysLeft);
          // Red blood cells typically have a 35-day shelf life
          const collectedDate = addDays(today, b.daysLeft - 35);
          insertBatch.run(h.id, group, b.units, collectedDate, expiryDate);
        }

        // 30 days of historical daily usage (oldest -> today)
        for (let offset = -29; offset <= 0; offset++) {
          const usageDate = addDays(today, offset);
          const unitsUsed = buildUsageValue(h.id, group, offset, rng);
          insertUsage.run(h.id, group, usageDate, unitsUsed);
        }
      }
    }

    // Seed one sample pending transfer request so transfer_requests is populated
    insertTransfer.run(5, 2, 'A+', 4, 'pending');

    return {
      hospitals: db.prepare('SELECT COUNT(*) AS count FROM hospitals').get().count,
      inventory_batches: db.prepare('SELECT COUNT(*) AS count FROM inventory_batches').get().count,
      daily_usage: db.prepare('SELECT COUNT(*) AS count FROM daily_usage').get().count,
      transfer_requests: db.prepare('SELECT COUNT(*) AS count FROM transfer_requests').get().count,
    };
  });

  return runSeed();
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  const counts = seedDatabase();
  console.log('Seeded BloodBridge database:');
  console.log(`  hospitals:         ${counts.hospitals}`);
  console.log(`  inventory_batches: ${counts.inventory_batches}`);
  console.log(`  daily_usage:       ${counts.daily_usage}`);
  console.log(`  transfer_requests: ${counts.transfer_requests}`);
}
