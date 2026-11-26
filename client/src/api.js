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
