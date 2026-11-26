# BloodBridge AI

BloodBridge AI monitors blood bank inventory across a regional hospital network and forecasts shortages 14 days ahead using expiry-aware FEFO (First-Expired, First-Out) simulation. When a hospital faces a shortage, it ranks nearby donor hospitals with surplus stock and helps coordinators request and complete inter-hospital blood transfers before stockouts or waste occur. It also surfaces soon-to-expire batches so hospitals can consume them locally or offer them to the network with a matching priority boost.

## Tech Stack

- **Frontend:** React 18, Vite, React Router, Recharts, Leaflet / React-Leaflet
- **Backend:** Node.js, Express
- **Database:** SQLite (`better-sqlite3`)

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Seed the database**
   ```bash
   npm run seed
   ```
3. **Run the app** (starts Express on `:4000` and Vite on `:5173`)
   ```bash
   npm run dev
   ```

## Prediction & Matching Logic

- **Prediction (FEFO 14-day simulation):** Daily demand is estimated as a weighted blend of the last 3 days (70%) and last 14 days (30%) of usage. Starting from today's active batches, each simulated day expires old units and consumes demand from the earliest-expiring batches first (FEFO) to find the exact stockout day and classify risk as `CRITICAL` (≤ 2 days), `HIGH` (≤ 4 days), `WATCH` (≤ 7 days), or `SAFE` (> 7 days).
- **Donor Matching:** Nearby hospitals within 50 km that have surplus units of the requested blood group are scored and ranked by proximity (50%), how much of the shortage they can cover (30%), whether they have units expiring within 3 days (20%), plus a +0.15 boost if they have explicitly offered expiring batches to the network.

## Demo Script

1. **Dashboard is mostly green:** Open `http://localhost:5173` (or click **Reset demo data** in the footer). Most of the 8 × 8 Hospital × Blood Group heatmap is `SAFE` (green), with one seeded `CRITICAL`/`WATCH` condition and a regional Leaflet map above the heatmap.
2. **Simulate a surge on a green cell:** Click any `SAFE` (green) cell (for example, Metro General Hospital `O+`), then click **Simulate Surge** on the hospital detail page. Return to the Dashboard and watch that cell turn `CRITICAL` (red) with a new alert in the Live Alert Feed.
3. **Match and transfer blood:** Click **Find Match →** on the alert (or open **Match** in the top nav), pick the #1 ranked donor on the list/map, and click **Request transfer**. Open **Transfers**, click **Approve**, and then **Complete** to move FEFO batches while preserving original expiry dates.
4. **Show the Expiry page:** Open **Expiry** in the top nav to view batches expiring within 3, 7, or 14 days, and click **Offer to network** (which boosts that donor on **Match**) or **Mark used**.
5. **Show the dashboard improving:** Return to **Dashboard** to see the shortage cell recover and the active alert clear after the completed transfer.
