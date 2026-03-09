import express from 'express';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'acne_tracker.db');
const db = new Database(dbPath);
const LOCAL_USER_ID = 'local-user';

console.log(`Using SQLite database at: ${dbPath}`);

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    name TEXT,
    picture TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS daily_logs (
    date TEXT,
    user_id TEXT,
    breakfast TEXT,
    lunch TEXT,
    dinner TEXT,
    snacks TEXT,
    water INTEGER DEFAULT 0,
    dairy TEXT,
    exercise INTEGER DEFAULT 0,
    sunlight INTEGER DEFAULT 0,
    sleep TEXT,
    stress INTEGER DEFAULT 0,
    pleasure INTEGER DEFAULT 0,
    whiteheads INTEGER DEFAULT 0,
    cystic_acne INTEGER DEFAULT 0,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (date, user_id)
  );
`);

// Migration: Add user_id to daily_logs if it doesn't exist (for existing local dbs)
try {
  const columns = db.prepare("PRAGMA table_info(daily_logs)").all() as any[];
  if (!columns.find(c => c.name === 'user_id')) {
    console.log('Migrating database: adding user_id to daily_logs');
    // Create new table with correct schema
    db.exec(`
      CREATE TABLE daily_logs_new (
        date TEXT,
        user_id TEXT,
        breakfast TEXT,
        lunch TEXT,
        dinner TEXT,
        snacks TEXT,
        water INTEGER DEFAULT 0,
        dairy TEXT,
        exercise INTEGER DEFAULT 0,
        sunlight INTEGER DEFAULT 0,
        sleep TEXT,
        stress INTEGER DEFAULT 0,
        pleasure INTEGER DEFAULT 0,
        whiteheads INTEGER DEFAULT 0,
        cystic_acne INTEGER DEFAULT 0,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (date, user_id)
      );
      
      INSERT INTO daily_logs_new (
        date, user_id, breakfast, lunch, dinner, snacks, water, dairy,
        exercise, sunlight, sleep, stress, pleasure, whiteheads, cystic_acne, notes, created_at, updated_at
      ) SELECT 
        date, '${LOCAL_USER_ID}', breakfast, lunch, dinner, snacks, water, dairy,
        exercise, 0, sleep, stress, pleasure, whiteheads, cystic_acne, notes, created_at, updated_at
      FROM daily_logs;

      DROP TABLE daily_logs;
      ALTER TABLE daily_logs_new RENAME TO daily_logs;
    `);
  }
} catch (error) {
  console.error('Migration failed:', error);
}

// Migration: add sunlight column for existing databases
try {
  const columns = db.prepare("PRAGMA table_info(daily_logs)").all() as any[];
  if (!columns.find(c => c.name === 'sunlight')) {
    console.log('Migrating database: adding sunlight to daily_logs');
    db.exec('ALTER TABLE daily_logs ADD COLUMN sunlight INTEGER DEFAULT 0');
  }
} catch (error) {
  console.error('Sunlight migration failed:', error);
}

// Ensure any existing rows are scoped to the local user
try {
  db.prepare("UPDATE daily_logs SET user_id = ? WHERE user_id IS NULL OR user_id = ''").run(LOCAL_USER_ID);
} catch (error) {
  console.error('Failed to normalize local user rows:', error);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  const toBoolean = (value: unknown): boolean => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value > 0;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true' || normalized === 'on' || normalized === 'yes') return true;
      const numeric = Number(normalized);
      if (Number.isFinite(numeric)) return numeric > 0;
      return false;
    }
    return false;
  };

  app.use(express.json());

  // API Routes
  app.get('/api/logs', (req, res) => {
    try {
      const { start, end } = req.query;
      let query = 'SELECT * FROM daily_logs WHERE user_id = ?';
      const params: string[] = [LOCAL_USER_ID];

      if (typeof start === 'string' && typeof end === 'string') {
        query += ' AND date BETWEEN ? AND ?';
        params.push(start, end);
      }

      query += ' ORDER BY date DESC';

      const logs = db.prepare(query).all(...params);
      res.json(logs);
    } catch (error) {
      console.error('Error fetching logs:', error);
      res.status(500).json({ error: 'Failed to fetch logs' });
    }
  });

  app.post('/api/logs', (req, res) => {
    try {
      const data = req.body;
      const { date } = data;

      if (!date) {
        return res.status(400).json({ error: 'Date is required' });
      }

      const stmt = db.prepare(`
        INSERT INTO daily_logs (
          date, user_id, breakfast, lunch, dinner, snacks, water, dairy,
          exercise, sunlight, sleep, stress, pleasure, whiteheads, cystic_acne, notes, updated_at
        ) VALUES (
          @date, @user_id, @breakfast, @lunch, @dinner, @snacks, @water, @dairy,
          @exercise, @sunlight, @sleep, @stress, @pleasure, @whiteheads, @cystic_acne, @notes, CURRENT_TIMESTAMP
        ) ON CONFLICT(date, user_id) DO UPDATE SET
          breakfast = excluded.breakfast,
          lunch = excluded.lunch,
          dinner = excluded.dinner,
          snacks = excluded.snacks,
          water = excluded.water,
          dairy = excluded.dairy,
          exercise = excluded.exercise,
          sunlight = excluded.sunlight,
          sleep = excluded.sleep,
          stress = excluded.stress,
          pleasure = excluded.pleasure,
          whiteheads = excluded.whiteheads,
          cystic_acne = excluded.cystic_acne,
          notes = excluded.notes,
          updated_at = CURRENT_TIMESTAMP
      `);

      const safeData = {
        ...data,
        user_id: LOCAL_USER_ID,
        water: Number.isFinite(Number(data.water)) ? Number(data.water) : 0,
        stress: Number.isFinite(Number(data.stress)) ? Math.max(0, Math.min(10, Number(data.stress))) : 0,
        exercise: toBoolean(data.exercise) ? 1 : 0,
        sunlight: toBoolean(data.sunlight) ? 1 : 0,
        pleasure: toBoolean(data.pleasure) ? 1 : 0,
        whiteheads: Number.isFinite(Number(data.whiteheads)) ? Number(data.whiteheads) : 0,
        cystic_acne: Number.isFinite(Number(data.cystic_acne)) ? Number(data.cystic_acne) : 0,
      };

      stmt.run(safeData);

      const savedLog = db
        .prepare('SELECT * FROM daily_logs WHERE date = ? AND user_id = ?')
        .get(date, LOCAL_USER_ID);

      res.json({ success: true, date, log: savedLog });
    } catch (error) {
      console.error('Error saving log:', error);
      res.status(500).json({ error: 'Failed to save log' });
    }
  });

  app.get('/api/export', (req, res) => {
    try {
      const logs = db.prepare('SELECT * FROM daily_logs WHERE user_id = ? ORDER BY date DESC').all(LOCAL_USER_ID);

      // Convert to CSV
      if (logs.length === 0) {
        return res.send('');
      }

      // Remove user_id from export if desired, or keep it. Let's keep it simple.
      const headers = Object.keys(logs[0]).join(',');
      const rows = logs.map(log => Object.values(log).map(val =>
        typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val
      ).join(','));

      const csv = [headers, ...rows].join('\n');

      res.header('Content-Type', 'text/csv');
      res.attachment('acne_tracker_export.csv');
      res.send(csv);
    } catch (error) {
      console.error('Error exporting logs:', error);
      res.status(500).json({ error: 'Failed to export logs' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
