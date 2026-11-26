export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

// Risk and threshold constants
export const SHORT_TERM_WINDOW_DAYS = 3;
export const SHORT_TERM_WEIGHT = 0.6;
export const LONG_TERM_WEIGHT = 0.4;
export const FORECAST_HORIZON_DAYS = 14;
export const STOCKOUT_EPSILON = 0.01;

export const RISK_THRESHOLDS = {
  CRITICAL_MAX_DAY: 2,
  HIGH_MAX_DAY: 4,
  WATCH_MAX_DAY: 7,
};

export const TARGET_COVER_DAYS = 5;
export const SAFETY_BUFFER_DAYS = 3;
export const EXPIRING_SOON_DAYS = 3;

export const O_NEG_WEIGHT = 1.2;
export const RH_NEG_WEIGHT = 1.1;
export const DEFAULT_GROUP_WEIGHT = 1.0;

export function todayDateString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function daysUntil(dateStr, fromDateStr = todayDateString()) {
  const [fy, fm, fd] = fromDateStr.split('-').map(Number);
  const [ty, tm, td] = dateStr.split('-').map(Number);
  const fromUtc = Date.UTC(fy, fm - 1, fd);
  const toUtc = Date.UTC(ty, tm - 1, td);
  return Math.round((toUtc - fromUtc) / 86400000);
}

const avg = a => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);

export function forecastDemand(usage14, surge = 1) {
  // usage14: daily units, oldest -> newest
  return (
    SHORT_TERM_WEIGHT * avg(usage14.slice(-SHORT_TERM_WINDOW_DAYS)) +
    LONG_TERM_WEIGHT * avg(usage14)
  ) * surge;
}

export function simulate(batches, demand, horizon = FORECAST_HORIZON_DAYS) {
  // batches: [{units, daysLeft}] with daysLeft = days until expiry
  const b = batches
    .filter(x => x.daysLeft >= 0)
    .map(x => ({ ...x }))
    .sort((a, c) => a.daysLeft - c.daysLeft); // FEFO
  let wasted = 0;
  let stockoutDay = null;
  for (let day = 1; day <= horizon; day++) {
    let need = demand;
    for (const x of b) {
      if (need <= 0) break;
      if (x.units > 0 && x.daysLeft >= day) {
        const take = Math.min(x.units, need);
        x.units -= take;
        need -= take;
      }
    }
    for (const x of b) {
      if (x.units > 0 && x.daysLeft <= day) {
        wasted += x.units;
        x.units = 0;
      }
    }
    if (need > STOCKOUT_EPSILON && stockoutDay === null) stockoutDay = day;
  }
  return { wasted: Math.round(wasted), stockoutDay };
}

const GROUP_WEIGHT = g =>
  g === 'O-' ? O_NEG_WEIGHT : g.endsWith('-') ? RH_NEG_WEIGHT : DEFAULT_GROUP_WEIGHT;

const level = d =>
  d == null
    ? 'SAFE'
    : d <= RISK_THRESHOLDS.CRITICAL_MAX_DAY
      ? 'CRITICAL'
      : d <= RISK_THRESHOLDS.HIGH_MAX_DAY
        ? 'HIGH'
        : d <= RISK_THRESHOLDS.WATCH_MAX_DAY
          ? 'WATCH'
          : 'SAFE';

export function assess({ group, batches, usage14, surge = 1 }) {
  const demand = forecastDemand(usage14, surge);
  const usable = batches.filter(b => b.daysLeft >= 0).reduce((s, b) => s + b.units, 0);
  const { wasted, stockoutDay } = simulate(batches, demand);
  const raw = stockoutDay ? (100 * (FORECAST_HORIZON_DAYS + 1 - stockoutDay)) / FORECAST_HORIZON_DAYS : 0;
  return {
    group,
    demandPerDay: +demand.toFixed(1),
    usableUnits: usable,
    daysOfCover: demand > 0 ? +(usable / demand).toFixed(1) : null,
    stockoutDay,
    wastedUnits: wasted,
    riskScore: Math.min(100, Math.round(raw * GROUP_WEIGHT(group))),
    riskLevel: level(stockoutDay),
    neededUnits: Math.max(0, Math.ceil(demand * TARGET_COVER_DAYS - usable)),
    surplusUnits: Math.max(0, Math.floor(usable - demand * SAFETY_BUFFER_DAYS)),
    expiringSoon: batches
      .filter(b => b.daysLeft >= 0 && b.daysLeft <= EXPIRING_SOON_DAYS)
      .reduce((s, b) => s + b.units, 0),
  };
}
