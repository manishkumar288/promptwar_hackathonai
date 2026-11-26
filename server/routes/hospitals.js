import { Router } from 'express';

const router = Router();

// Temporary M1 hospital list (will be backed by SQLite in M2)
const SAMPLE_HOSPITALS = [
  { id: 1, name: 'Metro General Hospital', lat: 12.9716, lng: 77.5946, phone: '555-0101' },
  { id: 2, name: 'St. Jude Memorial Medical Center', lat: 12.9850, lng: 77.6100, phone: '555-0102' },
  { id: 3, name: 'City Trauma & Emergency Care', lat: 12.9580, lng: 77.5800, phone: '555-0103' },
  { id: 4, name: 'Eastside Community Blood Center', lat: 12.9900, lng: 77.6450, phone: '555-0104' },
  { id: 5, name: 'Northpoint Regional Hospital', lat: 13.0400, lng: 77.5900, phone: '555-0105' },
  { id: 6, name: 'Lakeside Heart & Vascular Institute', lat: 12.9300, lng: 77.6250, phone: '555-0106' },
  { id: 7, name: 'Westgate Surgical Clinic', lat: 12.9650, lng: 77.5200, phone: '555-0107' },
  { id: 8, name: 'Southview Children & Maternity Hospital', lat: 12.9050, lng: 77.5850, phone: '555-0108' },
];

router.get('/', (req, res) => {
  res.json(SAMPLE_HOSPITALS);
});

export default router;
