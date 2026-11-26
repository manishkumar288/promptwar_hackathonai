export async function fetchHospitals() {
  const response = await fetch('/api/hospitals');
  if (!response.ok) {
    throw new Error(`Failed to fetch hospitals (${response.status})`);
  }
  return response.json();
}
