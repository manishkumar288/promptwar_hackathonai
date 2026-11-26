CREATE TABLE hospitals (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL,
  lat REAL NOT NULL, lng REAL NOT NULL, phone TEXT
);

-- one row per batch (needed for expiry / FEFO logic)
CREATE TABLE inventory_batches (
  id INTEGER PRIMARY KEY,
  hospital_id INTEGER NOT NULL REFERENCES hospitals(id),
  blood_group TEXT NOT NULL,            -- 'A+','A-','B+','B-','AB+','AB-','O+','O-'
  units INTEGER NOT NULL,
  collected_date TEXT NOT NULL,         -- 'YYYY-MM-DD'
  expiry_date TEXT NOT NULL             -- red cells ≈ collected + 35 days
);

-- daily consumption history (forecast input)
CREATE TABLE daily_usage (
  id INTEGER PRIMARY KEY,
  hospital_id INTEGER NOT NULL REFERENCES hospitals(id),
  blood_group TEXT NOT NULL,
  usage_date TEXT NOT NULL,
  units_used INTEGER NOT NULL,
  UNIQUE (hospital_id, blood_group, usage_date)
);

CREATE TABLE transfer_requests (
  id INTEGER PRIMARY KEY,
  from_hospital_id INTEGER NOT NULL REFERENCES hospitals(id),  -- donor
  to_hospital_id   INTEGER NOT NULL REFERENCES hospitals(id),  -- in need
  blood_group TEXT NOT NULL, units INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',   -- pending|approved|completed|rejected
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
