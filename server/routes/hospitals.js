import { Router } from 'express';
import db from '../db.js';

const router = Router();

router.get('/', (req, res) => {
  const hospitals = db
    .prepare('SELECT id, name, lat, lng, phone FROM hospitals ORDER BY id')
    .all();
  res.json(hospitals);
});

export default router;
