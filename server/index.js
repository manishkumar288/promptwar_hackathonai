import express from 'express';
import cors from 'cors';
import hospitalsRouter from './routes/hospitals.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'bloodbridge-server' });
});

app.use('/api/hospitals', hospitalsRouter);

app.listen(PORT, () => {
  console.log(`BloodBridge server listening on http://localhost:${PORT}`);
});
