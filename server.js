/**
 * Express server + MySQL (admin login + manage registrations/consultations)
 * ------------------------------------------------------------
 * Yêu cầu:
 * - MySQL 8+
 * - Import admin/database.sql vào database `thayha_admin`
 *
 * Cài đặt:
 *   npm i express mysql2 bcrypt jsonwebtoken cors dotenv
 *
 * Chạy:
 *   node server.js
 */

const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');

require('dotenv').config();

const app = express();

// ---- Config ----
const PORT = Number(process.env.PORT || 3000);
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = Number(process.env.DB_PORT || 3306);
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || 'thayha_admin';
const JWT_SECRET = process.env.JWT_SECRET || 'change_me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// ---- Middleware ----
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request timeout middleware (30 seconds)
app.use((req, res, next) => {
  req.setTimeout(30000);
  res.setTimeout(30000);
  next();
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('Express error:', err);
  res.status(500).json({ ok: false, message: 'Internal server error' });
});

// ---- DB Pool ----
let db;
async function initDb() {
  db = await mysql.createPool({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    namedPlaceholders: true,
    enableKeepAlive: true,
    keepAliveInitialDelayMs: 0
  });
  
  // Add error handler for pool
  db.on('error', (err) => {
    console.error('Database pool error:', err);
    // Attempt to reconnect
    setTimeout(() => {
      console.log('Attempting to reconnect to database...');
      initDb().catch((e) => console.error('Reconnect failed:', e));
    }, 5000);
  });
  
  db.on('connection', () => {
    console.log('New database connection established');
  });
}
initDb().catch((err) => {
  console.error('DB init error:', err);
  process.exit(1);
});

// ---- Helpers ----
function sendError(res, status, message, details) {
  res.status(status).json({ ok: false, message, details: details || null });
}

// Wrap async errors
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return sendError(res, 401, 'Missing token');
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.admin = payload;
    return next();
  } catch (e) {
    return sendError(res, 401, 'Invalid token');
  }
}

// ============================================================
// ---- Public API (receiving user forms) ----
// ============================================================

/**
 * POST /api/customers/register
 */
app.post('/api/customers/register', asyncHandler(async (req, res) => {
  const { full_name, phone, email, source, course_class_id, course_id, note } = req.body || {};
  if (!full_name || typeof full_name !== 'string') return sendError(res, 400, 'Missing full_name');
  if (!phone || typeof phone !== 'string') return sendError(res, 400, 'Missing phone');

  const src = source || 'website';

  const [existing] = await db.query('SELECT id FROM customers WHERE phone = :phone LIMIT 1', { phone });
  let customerId;
  if (existing.length) {
    customerId = existing[0].id;
    await db.query(
      'UPDATE customers SET full_name=:full_name, email=:email, source=:source, updated_at=CURRENT_TIMESTAMP WHERE id=:id',
      { full_name, email: email || null, source: src, id: customerId }
    );
  } else {
    const [ins] = await db.query(
      'INSERT INTO customers(full_name, phone, email, source) VALUES(:full_name, :phone, :email, :source)',
      { full_name, phone, email: email || null, source: src }
    );
    customerId = ins.insertId;
  }

  const [insReg] = await db.query(
    `INSERT INTO registrations(customer_id, course_class_id, course_id, registration_type, note)
     VALUES(:customer_id, :course_class_id, :course_id, 'register', :note)`,
    { customer_id: customerId, course_class_id: course_class_id || null, course_id: course_id || null, note: note || '' }
  );

  res.json({ ok: true, registration_id: insReg.insertId, customer_id: customerId });
}));

/**
 * POST /api/customers/consult
 */
app.post('/api/customers/consult', asyncHandler(async (req, res) => {
  const { full_name, phone, email, source, course_id, topic, message } = req.body || {};
  if (!full_name || typeof full_name !== 'string') return sendError(res, 400, 'Missing full_name');
  if (!phone || typeof phone !== 'string') return sendError(res, 400, 'Missing phone');

  const src = source || 'website';

  const [existing] = await db.query('SELECT id FROM customers WHERE phone = :phone LIMIT 1', { phone });
  let customerId;
  if (existing.length) {
    customerId = existing[0].id;
    await db.query(
      'UPDATE customers SET full_name=:full_name, email=:email, source=:source, updated_at=CURRENT_TIMESTAMP WHERE id=:id',
      { full_name, email: email || null, source: src, id: customerId }
    );
  } else {
    const [ins] = await db.query(
      'INSERT INTO customers(full_name, phone, email, source) VALUES(:full_name, :phone, :email, :source)',
      { full_name, phone, email: email || null, source: src }
    );
    customerId = ins.insertId;
  }

  const [insCon] = await db.query(
    `INSERT INTO consultations(customer_id, course_id, topic, message, admin_status, admin_note)
     VALUES(:customer_id, :course_id, :topic, :message, 'new', '')`,
    { customer_id: customerId, course_id: course_id || null, topic: topic || '', message: message || '' }
  );

  res.json({ ok: true, consultation_id: insCon.insertId, customer_id: customerId });
}));

// ============================================================
// ---- Public API (customer info / courses) ----
// ============================================================

app.get('/api/customers/info', asyncHandler(async (req, res) => {
  const customerId = req.query.customer_id ? Number(req.query.customer_id) : null;
  const phone = req.query.phone ? String(req.query.phone) : null;
  if (!customerId && !phone) return sendError(res, 400, 'Missing customer_id or phone');

  const sql = customerId
    ? 'SELECT id, full_name, phone, email, source, created_at, updated_at FROM customers WHERE id = :id LIMIT 1'
    : 'SELECT id, full_name, phone, email, source, created_at, updated_at FROM customers WHERE phone = :phone LIMIT 1';
  const params = customerId ? { id: customerId } : { phone };
  const [rows] = await db.query(sql, params);
  if (!rows.length) return sendError(res, 404, 'Customer not found');
  res.json({ ok: true, customer: rows[0] });
}));

app.get('/api/customers/:id/registrations', asyncHandler(async (req, res) => {
  const customerId = Number(req.params.id);
  if (!customerId) return sendError(res, 400, 'Invalid customer_id');
  const [rows] = await db.query(
    `SELECT r.id, r.customer_id, r.course_id, r.course_class_id, r.registration_type,
            r.note, r.admin_status, r.admin_note, r.created_at, r.updated_at
     FROM registrations r WHERE r.customer_id = :customer_id ORDER BY r.created_at DESC`,
    { customer_id: customerId }
  );
  res.json({ ok: true, registrations: rows });
}));

app.get('/api/courses', asyncHandler(async (req, res) => {
  const [rows] = await db.query(
    'SELECT id, course_code, course_name, slug, description FROM courses WHERE is_active=1 ORDER BY course_code ASC'
  );
  res.json({ ok: true, courses: rows });
}));

app.get('/api/course-classes', asyncHandler(async (req, res) => {
  const courseId = req.query.course_id ? Number(req.query.course_id) : null;
  const sql = courseId
    ? 'SELECT id, course_id, class_name, start_date, end_date, schedule_note, capacity, status FROM course_classes WHERE course_id=:course_id ORDER BY start_date ASC'
    : 'SELECT id, course_id, class_name, start_date, end_date, schedule_note, capacity, status FROM course_classes ORDER BY start_date ASC';
  const [rows] = courseId ? await db.query(sql, { course_id: courseId }) : await db.query(sql);
  res.json({ ok: true, classes: rows });
}));

// ============================================================
// ---- Admin APIs ----
// ============================================================

/**
 * POST /api/admin/login
 */
app.post('/api/admin/login', asyncHandler(async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || typeof username !== 'string') return sendError(res, 400, 'Missing username');
  if (!password || typeof password !== 'string') return sendError(res, 400, 'Missing password');

  const [rows] = await db.query(
    'SELECT id, username, password_hash, full_name, role, is_active FROM admin_users WHERE username=:username LIMIT 1',
    { username }
  );
  if (!rows.length) return sendError(res, 401, 'Invalid credentials');

  const admin = rows[0];
  if (admin.is_active !== 1) return sendError(res, 403, 'Admin disabled');

  const ok = await bcrypt.compare(password, admin.password_hash);
  if (!ok) return sendError(res, 401, 'Invalid credentials');

  const token = jwt.sign(
    { id: admin.id, username: admin.username, role: admin.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  res.json({
    ok: true, token,
    admin: { id: admin.id, username: admin.username, role: admin.role, full_name: admin.full_name }
  });
}));

/**
 * GET /api/admin/dashboard/overview
 */
app.get('/api/admin/dashboard/overview', authMiddleware, asyncHandler(async (req, res) => {
  const [regNew] = await db.query("SELECT COUNT(*) AS c FROM registrations WHERE admin_status='new'");
  const [conNew] = await db.query("SELECT COUNT(*) AS c FROM consultations WHERE admin_status='new'");
  const [regInProgress] = await db.query("SELECT COUNT(*) AS c FROM registrations WHERE admin_status='in_progress'");
  const [coursesOpen] = await db.query("SELECT COUNT(*) AS c FROM course_classes WHERE status='open'");

  res.json({
    ok: true,
    overview: {
      registrations_new: regNew[0].c,
      consultations_new: conNew[0].c,
      registrations_in_progress: regInProgress[0].c,
      classes_open: coursesOpen[0].c
    }
  });
}));

/**
 * GET /api/admin/customers
 */
app.get('/api/admin/customers', authMiddleware, asyncHandler(async (req, res) => {
  const [rows] = await db.query(
    `SELECT id, full_name, phone, email, source, created_at, updated_at
     FROM customers ORDER BY created_at DESC LIMIT 1000`
  );
  res.json({ ok: true, customers: rows });
}));

/**
 * GET /api/admin/registrations?status=new
 */
app.get('/api/admin/registrations', authMiddleware, asyncHandler(async (req, res) => {
  const status = req.query.status || 'new';
  const [rows] = await db.query(
    `SELECT r.id, r.created_at, r.admin_status, r.note, r.admin_note,
            c.full_name, c.phone, c.email, r.course_id, r.course_class_id
     FROM registrations r
     JOIN customers c ON c.id = r.customer_id
     WHERE r.admin_status = :status
     ORDER BY r.created_at DESC LIMIT 200`,
    { status }
  );
  res.json({ ok: true, registrations: rows });
}));

/**
 * GET /api/admin/students/registrations
 */
app.get('/api/admin/students/registrations', authMiddleware, asyncHandler(async (req, res) => {
  const [rows] = await db.query(
    `SELECT
      r.id AS registration_id,
      r.created_at,
      r.admin_status,
      r.note,
      r.admin_note,
      c.id AS customer_id,
      c.full_name,
      c.phone,
      c.email,
      c.source AS customer_source,
      r.course_id,
      r.course_class_id,
      CASE
        WHEN r.course_id IS NOT NULL THEN CONCAT('Hạng ', co.course_code)
        WHEN r.course_class_id IS NOT NULL THEN CONCAT('Lớp ', cc.class_name)
        ELSE 'N/A'
      END AS course_name
     FROM registrations r
     JOIN customers c ON c.id = r.customer_id
     LEFT JOIN courses co ON co.id = r.course_id
     LEFT JOIN course_classes cc ON cc.id = r.course_class_id
     ORDER BY r.created_at DESC LIMIT 1000`
  );
  res.json({ ok: true, registrations: rows });
}));

/**
 * POST /api/admin/registrations/:id/status
 */
app.post('/api/admin/registrations/:id/status', authMiddleware, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { admin_status, admin_note } = req.body || {};
  if (!id) return sendError(res, 400, 'Invalid id');
  if (!admin_status) return sendError(res, 400, 'Missing admin_status');

  await db.query(
    'UPDATE registrations SET admin_status=:admin_status, admin_note=:admin_note, updated_at=CURRENT_TIMESTAMP WHERE id=:id',
    { admin_status, admin_note: admin_note || '', id }
  );
  res.json({ ok: true });
}));

/**
 * POST /api/admin/registrations/:id/delete
 * FIX: Xóa đúng thứ tự FK, không xóa customer nếu còn dữ liệu liên quan khác
 */
app.post('/api/admin/registrations/:id/delete', authMiddleware, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return sendError(res, 400, 'Invalid id');

  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    // 1) Lấy customer_id trước khi xóa
    const [regRows] = await conn.query(
      'SELECT id, customer_id FROM registrations WHERE id = :id LIMIT 1',
      { id }
    );
    if (!regRows.length) {
      await conn.rollback();
      conn.release();
      return sendError(res, 404, 'Registration not found');
    }
    const customerId = regRows[0].customer_id;

    // 2) Xóa registration
    await conn.query('DELETE FROM registrations WHERE id = :id', { id });

    // 3) Kiểm tra còn registration nào của customer này không
    const [remaining] = await conn.query(
      'SELECT COUNT(*) AS c FROM registrations WHERE customer_id = :customer_id',
      { customer_id: customerId }
    );

    // 4) Nếu không còn registration nào => kiểm tra tiếp consultations
    if (Number(remaining[0].c) === 0) {
      const [conRows] = await conn.query(
        'SELECT COUNT(*) AS c FROM consultations WHERE customer_id = :customer_id',
        { customer_id: customerId }
      );
      // Nếu cũng không có consultation => xóa luôn customer
      if (Number(conRows[0].c) === 0) {
        // Xóa các bảng FK RESTRICT trước
        await conn.query('DELETE FROM payments WHERE customer_id = :customer_id', { customer_id: customerId });
        await conn.query('DELETE FROM attendance WHERE customer_id = :customer_id', { customer_id: customerId });
        await conn.query('DELETE FROM class_enrollment WHERE customer_id = :customer_id', { customer_id: customerId });
        await conn.query('DELETE FROM notifications WHERE customer_id = :customer_id', { customer_id: customerId });
        await conn.query('DELETE FROM customers WHERE id = :id', { id: customerId });
      }
      // Nếu còn consultation thì giữ lại customer (không xóa)
    }

    await conn.commit();
    conn.release();
    res.json({ ok: true });
  } catch (e) {
    console.error('Delete registration error:', e);
    if (conn) {
      try { await conn.rollback(); } catch (_) {}
      try { conn.release(); } catch (_) {}
    }
    return sendError(res, 500, 'Server error', e?.message ? String(e.message) : null);
  }
}));

/**
 * POST /api/admin/customers/:id/delete  ← ROUTE MỚI
 * Xóa trực tiếp customer (kể cả khi không có registration)
 */
app.post('/api/admin/customers/:id/delete', authMiddleware, asyncHandler(async (req, res) => {
  const customerId = Number(req.params.id);
  if (!customerId) return sendError(res, 400, 'Invalid customer_id');

  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    // Kiểm tra customer tồn tại
    const [custRows] = await conn.query(
      'SELECT id FROM customers WHERE id = :id LIMIT 1',
      { id: customerId }
    );
    if (!custRows.length) {
      await conn.rollback();
      conn.release();
      return sendError(res, 404, 'Customer not found');
    }

    // Xóa đúng thứ tự FK (từ con đến cha)
    await conn.query('DELETE FROM attendance WHERE customer_id = :id', { id: customerId });
    await conn.query('DELETE FROM class_enrollment WHERE customer_id = :id', { id: customerId });
    await conn.query('DELETE FROM notifications WHERE customer_id = :id', { id: customerId });
    await conn.query('DELETE FROM payments WHERE customer_id = :id', { id: customerId });
    await conn.query('DELETE FROM consultations WHERE customer_id = :id', { id: customerId });
    await conn.query('DELETE FROM registrations WHERE customer_id = :id', { id: customerId });
    await conn.query('DELETE FROM customers WHERE id = :id', { id: customerId });

    await conn.commit();
    conn.release();
    res.json({ ok: true });
  } catch (e) {
    console.error('Delete customer error:', e);
    if (conn) {
      try { await conn.rollback(); } catch (_) {}
      try { conn.release(); } catch (_) {}
    }
    return sendError(res, 500, 'Server error', e?.message ? String(e.message) : null);
  }
}));

// ============================================================
// ---- Consultations ----
// ============================================================

/**
 * GET /api/admin/consultations?status=new
 * FIX: Route này bị thiếu "app.get" trong code gốc!
 */
app.get('/api/admin/consultations', authMiddleware, asyncHandler(async (req, res) => {
  const status = req.query.status || 'new';
  const [rows] = await db.query(
    `SELECT con.id, con.created_at, con.admin_status, con.topic, con.message,
            con.admin_note, c.full_name, c.phone, c.email, con.course_id
     FROM consultations con
     JOIN customers c ON c.id = con.customer_id
     WHERE con.admin_status = :status
     ORDER BY con.created_at DESC LIMIT 200`,
    { status }
  );
  res.json({ ok: true, consultations: rows });
}));

/**
 * POST /api/admin/consultations/:id/status
 */
app.post('/api/admin/consultations/:id/status', authMiddleware, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { admin_status, admin_note } = req.body || {};
  if (!id) return sendError(res, 400, 'Invalid id');
  if (!admin_status) return sendError(res, 400, 'Missing admin_status');

  await db.query(
    'UPDATE consultations SET admin_status=:admin_status, admin_note=:admin_note, updated_at=CURRENT_TIMESTAMP WHERE id=:id',
    { admin_status, admin_note: admin_note || '', id }
  );
  res.json({ ok: true });
}));

// ============================================================
// ---- Debug & Health ----
// ============================================================

app.get('/api/debug/db', asyncHandler(async (req, res) => {
  const [dbInfoRows] = await db.query('SELECT DATABASE() AS db_name');
  const [adminCountRows] = await db.query('SELECT COUNT(*) AS c FROM admin_users');
  const [adminRows] = await db.query(
    'SELECT id, username, full_name, role, is_active FROM admin_users ORDER BY id ASC LIMIT 10'
  );
  const [courseRows] = await db.query(
    'SELECT course_code, course_name FROM courses ORDER BY id ASC LIMIT 5'
  );
  res.json({
    ok: true,
    config: { DB_HOST, DB_PORT, DB_USER, DB_NAME },
    connected: { current_db: dbInfoRows[0]?.db_name || DB_NAME },
    admin_users_count: adminCountRows[0]?.c ?? 0,
    admins: adminRows,
    courses_sample: courseRows
  });
}));

app.get('/health', (req, res) => res.json({ ok: true }));

// ============================================================
// ---- Error Handlers ----
// ============================================================

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Don't exit, try to keep running
  // In production, you might want to log this and restart
});

// Graceful shutdown on SIGTERM
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(async () => {
    console.log('HTTP server closed');
    if (db) {
      try {
        await db.end();
        console.log('Database pool closed');
      } catch (err) {
        console.error('Error closing database:', err);
      }
    }
    process.exit(0);
  });
});

// Graceful shutdown on SIGINT (Ctrl+C)
process.on('SIGINT', async () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(async () => {
    console.log('HTTP server closed');
    if (db) {
      try {
        await db.end();
        console.log('Database pool closed');
      } catch (err) {
        console.error('Error closing database:', err);
      }
    }
    process.exit(0);
  });
});

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Database: ${DB_HOST}:${DB_PORT}/${DB_NAME}`);
});