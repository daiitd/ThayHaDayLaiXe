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

// Fallback nếu .env không đọc được
if (!process.env.GMAIL_USER) process.env.GMAIL_USER = 'phuongnguyendai240@gmail.com';
if (!process.env.GMAIL_APP_PASSWORD) process.env.GMAIL_APP_PASSWORD = 'eqkqorwosrpodmbc';

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
  const { full_name, phone, email, source, course_id, course_code, topic, message } = req.body || {};
  if (!full_name || typeof full_name !== 'string') return sendError(res, 400, 'Missing full_name');
  if (!phone || typeof phone !== 'string') return sendError(res, 400, 'Missing phone');

  const src = source || 'website';
  let selectedCourseId = null;

  if (course_id) {
    selectedCourseId = Number(course_id) || null;
  } else if (course_code) {
    const [courseRows] = await db.query('SELECT id FROM courses WHERE course_code = :course_code LIMIT 1', { course_code });
    if (courseRows.length) selectedCourseId = courseRows[0].id;
  }

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
    { customer_id: customerId, course_id: selectedCourseId, topic: topic || 'Tư vấn khóa học', message: message || '' }
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


/**
 * POST /api/admin/customers/:id/update
 * Cập nhật thông tin khách hàng (tên, phone, email)
 */
app.post('/api/admin/customers/:id/update', authMiddleware, asyncHandler(async (req, res) => {
  const customerId = Number(req.params.id);
  if (!customerId) return sendError(res, 400, 'Invalid customer_id');

  const { full_name, phone, email } = req.body || {};
  if (!full_name || typeof full_name !== 'string') return sendError(res, 400, 'Missing full_name');
  if (!phone || typeof phone !== 'string') return sendError(res, 400, 'Missing phone');

  // Kiểm tra customer tồn tại
  const [custRows] = await db.query(
    'SELECT id FROM customers WHERE id = :id LIMIT 1',
    { id: customerId }
  );
  if (!custRows.length) return sendError(res, 404, 'Customer not found');

  await db.query(
    'UPDATE customers SET full_name=:full_name, phone=:phone, email=:email, updated_at=CURRENT_TIMESTAMP WHERE id=:id',
    { full_name, phone, email: email || null, id: customerId }
  );

  res.json({ ok: true });
}));

// ============================================================
// ---- Consultations ----
// ============================================================

/**
 * GET /api/admin/consultations?status=new
 * FIX: Route này bị thiếu "app.get" trong code gốc!
 */
app.get('/api/admin/consultations', authMiddleware, asyncHandler(async (req, res) => {
  const status = req.query.status || 'all';
  const params = {};
  let whereClause = '';

  if (status !== 'all') {
    whereClause = 'WHERE con.admin_status = :status';
    params.status = status;
  }

  const [rows] = await db.query(
    `SELECT con.id, con.created_at, con.updated_at, con.admin_status, con.topic, con.message,
            con.admin_note, c.full_name, c.phone, c.email, con.course_id,
            cr.course_name, cr.course_code
     FROM consultations con
     JOIN customers c ON c.id = con.customer_id
     LEFT JOIN courses cr ON cr.id = con.course_id
     ${whereClause}
     ORDER BY con.created_at DESC LIMIT 200`,
    params
  );
  res.json({ ok: true, consultations: rows });
}));



// PUT /api/admin/consultations/:id — cập nhật đầy đủ
app.put('/api/admin/consultations/:id', authMiddleware, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return sendError(res, 400, 'Invalid id');

  const { full_name, phone, email, course_code, topic, message, admin_status, admin_note } = req.body || {};
  if (!full_name) return sendError(res, 400, 'Missing full_name');
  if (!phone)     return sendError(res, 400, 'Missing phone');

  const [conRows] = await db.query(
    'SELECT customer_id FROM consultations WHERE id = :id LIMIT 1',
    { id }
  );
  if (!conRows.length) return sendError(res, 404, 'Consultation not found');
  const customerId = conRows[0].customer_id;

  // Cập nhật thông tin khách hàng
  await db.query(
    'UPDATE customers SET full_name=:full_name, phone=:phone, email=:email, updated_at=CURRENT_TIMESTAMP WHERE id=:id',
    { full_name, phone, email: email || null, id: customerId }
  );

  // Tìm course_id từ course_code
  let newCourseId = null;
  if (course_code) {
    const [courseRows] = await db.query(
      'SELECT id FROM courses WHERE course_code = :course_code LIMIT 1',
      { course_code }
    );
    if (courseRows.length) newCourseId = courseRows[0].id;
  }

  // Cập nhật consultation
  await db.query(
    `UPDATE consultations
     SET course_id=:course_id, topic=:topic, message=:message,
         admin_status=:admin_status, admin_note=:admin_note,
         updated_at=CURRENT_TIMESTAMP
     WHERE id=:id`,
    {
      course_id:    newCourseId,
      topic:        topic || 'Tư vấn khóa học',
      message:      message || '',
      admin_status: admin_status || 'new',
      admin_note:   admin_note || '',
      id
    }
  );

  res.json({ ok: true });
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




// ============================================================
// FORGOT PASSWORD - Thêm vào server.js
// ============================================================
// Cài đặt thêm: npm i nodemailer
//
// Thêm vào file .env:
//   GMAIL_USER=your_gmail@gmail.com
//   GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
//   (App Password: myaccount.google.com > Security > 2FA > App passwords)
//   FRONTEND_URL=https://daylaixethayha.com
//
// Dán toàn bộ đoạn này vào server.js TRƯỚC dòng app.listen(...)
// ============================================================

const nodemailer = require('nodemailer');

// ── OTP Store (in-memory) ──────────────────────────────────
// Map: email => { otp, username, expires, adminId }
const otpStore = new Map();

// Xóa OTP hết hạn mỗi 5 phút
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of otpStore.entries()) {
    if (val.expires < now) otpStore.delete(key);
  }
}, 5 * 60 * 1000);

// ── Nodemailer transporter ─────────────────────────────────
function createTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD // App Password (không phải mật khẩu Gmail thường)
    }
  });
}

// ── Tạo OTP 6 chữ số ──────────────────────────────────────
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ── HTML Email Template ────────────────────────────────────
function buildEmailHTML(otp, adminName) {
  return `
<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Xác nhận OTP - Thầy Hà</title>
</head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa;padding:30px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(11,31,74,0.10);">
        
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0b1f4a,#163a80);padding:32px 40px;text-align:center;">
            <div style="font-size:2rem;font-weight:800;color:#fff;letter-spacing:1px;">🚗 Thầy Hà</div>
            <div style="color:rgba(255,255,255,0.75);font-size:0.85rem;margin-top:6px;text-transform:uppercase;letter-spacing:2px;">Trung tâm Đào tạo lái xe</div>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <h2 style="margin:0 0 8px;color:#0b1f4a;font-size:1.4rem;">Đặt lại mật khẩu</h2>
            <p style="color:#6c7a8a;margin:0 0 28px;font-size:0.95rem;">
              Xin chào <strong style="color:#0b1f4a;">${adminName}</strong>,<br>
              Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản admin của bạn.
            </p>

            <!-- OTP Box -->
            <div style="background:#f0f4ff;border:2px dashed #3a6bd4;border-radius:12px;padding:28px;text-align:center;margin-bottom:28px;">
              <div style="color:#6c7a8a;font-size:0.85rem;text-transform:uppercase;letter-spacing:2px;margin-bottom:12px;">Mã xác nhận OTP</div>
              <div style="font-size:2.8rem;font-weight:800;letter-spacing:12px;color:#0b1f4a;font-family:'Courier New',monospace;">${otp}</div>
              <div style="color:#e84040;font-size:0.82rem;margin-top:12px;">⏱ Mã có hiệu lực trong <strong>10 phút</strong></div>
            </div>

            <div style="background:#fff8f0;border-left:4px solid #f4782a;border-radius:6px;padding:14px 16px;margin-bottom:24px;">
              <div style="color:#856404;font-size:0.85rem;">
                ⚠️ <strong>Lưu ý bảo mật:</strong> Không chia sẻ mã OTP này với bất kỳ ai. 
                Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.
              </div>
            </div>

            <p style="color:#aab4c0;font-size:0.82rem;margin:0;">
              Email này được gửi tự động từ hệ thống Thầy Hà. Vui lòng không trả lời email này.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8f9fc;padding:18px 40px;border-top:1px solid #e8edf5;text-align:center;">
            <div style="color:#aab4c0;font-size:0.78rem;">
              © 2026 Thầy Hà - Đào tạo lái xe ĐH An Ninh TP.HCM<br>
              km18 Song Hành Xa Lộ Hà Nội · 0941 822 239
            </div>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}


// ============================================================
// ROUTE 1: POST /api/admin/forgot-password
// Body: { email }  → Gửi OTP về email nếu tồn tại
// ============================================================
app.post('/api/admin/forgot-password', asyncHandler(async (req, res) => {
  const { email } = req.body || {};
  if (!email || typeof email !== 'string') return sendError(res, 400, 'Missing email');

  const normalizedEmail = email.trim().toLowerCase();

  // Kiểm tra rate limit: không cho spam (1 lần / 60 giây mỗi email)
  if (otpStore.has(normalizedEmail)) {
    const existing = otpStore.get(normalizedEmail);
    const secondsAgo = (Date.now() - (existing.expires - 10 * 60 * 1000)) / 1000;
    if (secondsAgo < 60) {
      return sendError(res, 429, `Vui lòng chờ ${Math.ceil(60 - secondsAgo)} giây trước khi gửi lại`);
    }
  }

  // Tìm admin theo email
  const [rows] = await db.query(
    'SELECT id, username, full_name, email, is_active FROM admin_users WHERE LOWER(email) = :email LIMIT 1',
    { email: normalizedEmail }
  );

  // Luôn trả về ok=true để tránh lộ thông tin (không cho biết email có tồn tại không)
  if (!rows.length || rows[0].is_active !== 1) {
    return res.json({ ok: true, message: 'Nếu email tồn tại, mã OTP sẽ được gửi trong vài giây.' });
  }

  const admin = rows[0];
  const otp   = generateOTP();

  // Lưu OTP (10 phút)
  otpStore.set(normalizedEmail, {
    otp,
    adminId:  admin.id,
    username: admin.username,
    fullName: admin.full_name,
    expires:  Date.now() + 10 * 60 * 1000
  });

  // Gửi email
  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from:    `"Thầy Hà - Admin System" <${process.env.GMAIL_USER}>`,
      to:      admin.email,
      subject: `[Thầy Hà] Mã OTP đặt lại mật khẩu: ${otp}`,
      html:    buildEmailHTML(otp, admin.full_name)
    });
  } catch (mailErr) {
    console.error('Send email error:', mailErr);
    otpStore.delete(normalizedEmail);
    return sendError(res, 500, 'Không thể gửi email. Kiểm tra cấu hình GMAIL_USER và GMAIL_APP_PASSWORD trong .env');
  }

  console.log(`[OTP] Sent to ${admin.email} for admin ${admin.username} - OTP: ${otp}`);
  res.json({ ok: true, message: 'Nếu email tồn tại, mã OTP sẽ được gửi trong vài giây.' });
}));

// ============================================================
// ROUTE 2: POST /api/admin/verify-otp
// Body: { email, otp }  → Xác minh OTP, trả về resetToken
// ============================================================
app.post('/api/admin/verify-otp', asyncHandler(async (req, res) => {
  const { email, otp } = req.body || {};
  if (!email) return sendError(res, 400, 'Missing email');
  if (!otp)   return sendError(res, 400, 'Missing otp');

  const normalizedEmail = email.trim().toLowerCase();
  const record = otpStore.get(normalizedEmail);

  if (!record)                         return sendError(res, 400, 'Mã OTP không hợp lệ hoặc đã hết hạn');
  if (Date.now() > record.expires)     { otpStore.delete(normalizedEmail); return sendError(res, 400, 'Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới'); }
  if (String(otp).trim() !== record.otp) return sendError(res, 400, 'Mã OTP không đúng');

  // Tạo một reset token ngắn hạn (5 phút) để bước 3 dùng
  const resetToken = jwt.sign(
    { adminId: record.adminId, email: normalizedEmail, purpose: 'reset_password' },
    JWT_SECRET,
    { expiresIn: '5m' }
  );

  // Đánh dấu OTP đã dùng (xóa để không dùng lại)
  otpStore.delete(normalizedEmail);

  res.json({
    ok:          true,
    resetToken,
    username:    record.username,
    fullName:    record.fullName,
    message:     'OTP hợp lệ. Bạn có 5 phút để đặt lại mật khẩu.'
  });
}));

// ============================================================
// ROUTE 3: POST /api/admin/reset-password
// Body: { resetToken, newUsername, newPassword }
// ============================================================
app.post('/api/admin/reset-password', asyncHandler(async (req, res) => {
  const { resetToken, newUsername, newPassword } = req.body || {};
  if (!resetToken)  return sendError(res, 400, 'Missing resetToken');
  if (!newUsername) return sendError(res, 400, 'Missing newUsername');
  if (!newPassword) return sendError(res, 400, 'Missing newPassword');

  // Kiểm tra độ mạnh mật khẩu
  if (newPassword.length < 6) return sendError(res, 400, 'Mật khẩu phải có ít nhất 6 ký tự');
  if (newUsername.length < 3) return sendError(res, 400, 'Tên tài khoản phải có ít nhất 3 ký tự');
  if (!/^[a-zA-Z0-9_]+$/.test(newUsername)) return sendError(res, 400, 'Tên tài khoản chỉ được chứa chữ cái, số và dấu gạch dưới');

  // Xác minh reset token
  let payload;
  try {
    payload = jwt.verify(resetToken, JWT_SECRET);
  } catch (e) {
    return sendError(res, 401, 'Token hết hạn hoặc không hợp lệ. Vui lòng bắt đầu lại');
  }

  if (payload.purpose !== 'reset_password') return sendError(res, 401, 'Token không hợp lệ');

  const adminId = payload.adminId;

  // Kiểm tra username mới có bị trùng không (trừ chính admin này)
  const [dupRows] = await db.query(
    'SELECT id FROM admin_users WHERE username = :username AND id != :id LIMIT 1',
    { username: newUsername, id: adminId }
  );
  if (dupRows.length) return sendError(res, 409, 'Tên tài khoản đã tồn tại. Vui lòng chọn tên khác');

  // Hash mật khẩu mới
  const passwordHash = await bcrypt.hash(newPassword, 10);

  // Cập nhật DB
  await db.query(
    'UPDATE admin_users SET username = :username, password_hash = :hash, updated_at = CURRENT_TIMESTAMP WHERE id = :id',
    { username: newUsername, hash: passwordHash, id: adminId }
  );

  console.log(`[RESET] Admin ID ${adminId} changed username to "${newUsername}"`);
  res.json({ ok: true, message: 'Đặt lại mật khẩu thành công! Bạn có thể đăng nhập với tài khoản mới.' });
}));




// ============================================================
// END FORGOT PASSWORD ROUTES
// ============================================================


const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Database: ${DB_HOST}:${DB_PORT}/${DB_NAME}`);
});