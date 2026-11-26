import express from 'express';
import cors from 'cors';
import hospitalsRouter from './routes/hospitals.js';
import predictionsRouter from './routes/predictions.js';
import alertsRouter from './routes/alerts.js';
import analyticsRouter from './routes/analytics.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'bloodbridge-server' });
});

app.use('/api/hospitals', hospitalsRouter);
app.use('/api/predictions', predictionsRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/analytics', analyticsRouter);

app.listen(PORT, () => {
  console.log(`BloodBridge server listening on http://localhost:${PORT}`);
});
