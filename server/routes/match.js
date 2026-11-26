import { Router } from 'express';
import { BLOOD_GROUPS } from '../engine/predict.js';
import { rankDonors } from '../engine/match.js';
import { getNetworkAssessments } from './predictions.js';

const router = Router();

router.get('/', (req, res) => {
  const hospitalId = Number(req.query.hospitalId);
  const group = req.query.group;

  if (!Number.isInteger(hospitalId) || hospitalId <= 0) {
    return res.status(400).json({ error: 'Valid hospitalId query parameter is required' });
  }
  if (!BLOOD_GROUPS.includes(group)) {
    return res.status(400).json({ error: 'Valid group query parameter is required' });
  }

  const assessments = getNetworkAssessments();
  const target = assessments.find((a) => a.hospitalId === hospitalId && a.group === group);
  if (!target) {
    return res.status(404).json({ error: 'Hospital not found' });
  }

  const donors = rankDonors(target, assessments);
  res.json({ target, donors });
});

export default router;
