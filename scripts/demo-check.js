import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const TEST_PORT = 4095;
const BASE_URL = `http://localhost:${TEST_PORT}`;
const RISK_ORDER = { CRITICAL: 0, HIGH: 1, WATCH: 2, SAFE: 3 };

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function api(route, options = {}) {
  const res = await fetch(`${BASE_URL}${route}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`${route} failed (${res.status}): ${body?.error || 'unknown'}`);
  }
  return body;
}

async function waitForServer(timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE_URL}/api/health`);
      if (res.ok) return;
    } catch {
      // retry
    }
    await sleep(200);
  }
  throw new Error('Server did not become healthy in time');
}

function report(name, passed, detail) {
  console.log(`[${passed ? 'PASS' : 'FAIL'}] ${name} — ${detail}`);
  return passed;
}

async function main() {
  const tempDb = path.join(os.tmpdir(), `bloodbridge-demo-check-${Date.now()}.db`);
  const serverProc = spawn('node', ['server/index.js'], {
    cwd: ROOT_DIR,
    env: { ...process.env, PORT: String(TEST_PORT), DB_PATH: tempDb },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let allPassed = true;

  try {
    await waitForServer();

    // 0. Fresh reset on disposable DB
    await api('/api/demo/reset', { method: 'POST', body: '{}' });

    // 1. Baseline check: Hospital 1 / O- should be SAFE or WATCH
    const predsBefore = await api('/api/predictions');
    const baseCell = predsBefore.find((p) => p.hospitalId === 1 && p.group === 'O-');
    const step1Ok = Boolean(baseCell && (baseCell.riskLevel === 'SAFE' || baseCell.riskLevel === 'WATCH'));
    allPassed &= report(
      'Baseline Hospital 1 / O- is SAFE or WATCH',
      step1Ok,
      `risk=${baseCell?.riskLevel}, usableUnits=${baseCell?.usableUnits}, demandPerDay=${baseCell?.demandPerDay}, stockoutDay=${baseCell?.stockoutDay}`
    );

    // Check API clamp at 5 (verify multiplier=10 clamps to 5)
    const clampTest = await api('/api/demo/surge', {
      method: 'POST',
      body: JSON.stringify({ hospitalId: 2, group: 'A+', multiplier: 10 }),
    });
    allPassed &= report(
      'Surge multiplier clamped at 5 in API',
      clampTest.multiplier === 5,
      `requested=10, returned=${clampTest.multiplier}`
    );

    // 2. 3x surge on Hospital 1 / O- must turn it CRITICAL
    const surgeRes = await api('/api/demo/surge', {
      method: 'POST',
      body: JSON.stringify({ hospitalId: 1, group: 'O-', multiplier: 3 }),
    });
    const predsAfterSurge = await api('/api/predictions');
    const surgedCell = predsAfterSurge.find((p) => p.hospitalId === 1 && p.group === 'O-');
    const step2Ok = Boolean(surgedCell && surgedCell.riskLevel === 'CRITICAL');
    allPassed &= report(
      '3x surge turns Hospital 1 / O- CRITICAL',
      step2Ok,
      `multiplier=${surgeRes.multiplier}, extraUnits=${surgeRes.extraUnits}, risk=${surgedCell?.riskLevel}, demandPerDay=${surgedCell?.demandPerDay}, stockoutDay=${surgedCell?.stockoutDay}, neededUnits=${surgedCell?.neededUnits}`
    );

    // 3. Top donor in /api/match must be Hospital 4 (within 10 km, expiring units)
    const matchRes = await api('/api/match?hospitalId=1&group=O-');
    const topDonor = matchRes.donors?.[0];
    const step3Ok = Boolean(
      topDonor &&
      topDonor.hospitalId === 4 &&
      topDonor.distanceKm <= 10 &&
      topDonor.expiringSoon > 0 &&
      topDonor.transferable > 0
    );
    allPassed &= report(
      'Hospital 4 ranks #1 in /api/match within 10 km',
      step3Ok,
      `topDonor=#${topDonor?.hospitalId} ${topDonor?.name}, distance=${topDonor?.distanceKm}km, transferable=${topDonor?.transferable}, expiringSoon=${topDonor?.expiringSoon}, score=${topDonor?.score}`
    );

    // 4. Complete transfer of transferable units and verify risk level improves (>= 1 level above CRITICAL)
    const createdTx = await api('/api/transfers', {
      method: 'POST',
      body: JSON.stringify({
        fromHospitalId: topDonor.hospitalId,
        toHospitalId: 1,
        bloodGroup: 'O-',
        units: topDonor.transferable,
      }),
    });
    await api(`/api/transfers/${createdTx.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'approved' }),
    });
    await api(`/api/transfers/${createdTx.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'completed' }),
    });

    const predsAfterTx = await api('/api/predictions');
    const recoveredCell = predsAfterTx.find((p) => p.hospitalId === 1 && p.group === 'O-');
    const step4Ok = Boolean(
      recoveredCell && RISK_ORDER[recoveredCell.riskLevel] > RISK_ORDER.CRITICAL
    );
    allPassed &= report(
      'Completed transfer raises Hospital 1 / O- by >= 1 risk level',
      step4Ok,
      `before=${surgedCell?.riskLevel} (${surgedCell?.usableUnits}u) -> after=${recoveredCell?.riskLevel} (${recoveredCell?.usableUnits}u, stockoutDay=${recoveredCell?.stockoutDay})`
    );
  } finally {
    serverProc.kill();
    await sleep(250);
    for (const suffix of ['', '-wal', '-shm']) {
      fs.rmSync(`${tempDb}${suffix}`, { force: true });
    }
  }

  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error('[FAIL] Unexpected error:', err);
  process.exit(1);
});
