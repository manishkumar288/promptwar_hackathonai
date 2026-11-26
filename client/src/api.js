async function request(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch {
      // ignore non-JSON error body
    }
    throw new Error(msg);
  }
  return res.json();
}

function sendJson(url, method, body) {
  return request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function fetchHospitals() {
  return request('/api/hospitals');
}

export function fetchHospital(id) {
  return request(`/api/hospitals/${id}`);
}

export function fetchPredictions() {
  return request('/api/predictions');
}

export function fetchAlerts() {
  return request('/api/alerts');
}

export function fetchAnalyticsSummary() {
  return request('/api/analytics/summary');
}

export function addBatch(payload) {
  return sendJson('/api/batches', 'POST', payload);
}

export function logUsage(payload) {
  return sendJson('/api/usage', 'POST', payload);
}

export function simulateSurge(payload) {
  return sendJson('/api/demo/surge', 'POST', payload);
}

export function resetDemoData() {
  return sendJson('/api/demo/reset', 'POST', {});
}

export function fetchMatch(hospitalId, group) {
  const params = new URLSearchParams({
    hospitalId: String(hospitalId),
    group,
  });
  return request(`/api/match?${params.toString()}`);
}

export function fetchTransfers() {
  return request('/api/transfers');
}

export function createTransfer(payload) {
  return sendJson('/api/transfers', 'POST', payload);
}

export function updateTransferStatus(id, status) {
  return sendJson(`/api/transfers/${id}`, 'PATCH', { status });
}

export function fetchExpiring(days = 7) {
  return request(`/api/expiring?days=${days}`);
}

export function markBatchUsed(batchId) {
  return sendJson(`/api/expiring/${batchId}/use`, 'POST', {});
}

export function offerBatchToNetwork(batchId, offered) {
  return sendJson(`/api/expiring/${batchId}/offer`, 'POST', { offered });
}
