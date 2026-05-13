/**
 * Express server + MySQL (admin login + manage registrations/consultations)
 * ------------------------------------------------------------
 * Yêu cầu:
 * - MySQL 8+
 * - Import admin/database.sql vào database `thayha_admin`
 *
 * Cài đặt (nếu dự án chưa có package.json):
 *   npm init -y
 *   npm i express mysql2 bcrypt jsonwebtoken cors dotenv
 *
 * Chạy:
 *   node server.js
 *
 * Mặc định:
 *   PORT=3000
 *   DB_HOST=localhost
 *   DB_PORT=3306
 *   DB_USER=root
 *   DB_PASSWORD=
 *   DB_NAME=thayha_admin
 *   JWT_SECRET=change_me
 */

// eslint-disable-next-line no-unused-vars
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
    namedPlaceholders: true
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

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return sendError(res, 401, 'Missing token');

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.admin = payload; // { id, username, role }
    return next();
  } catch (e) {
    return sendError(res, 401, 'Invalid token');
  }
}

// ---- Public API (receiving user forms) ----

/**
 * POST /api/customers/register
 * Lưu đăng ký học (tạo customer nếu chưa có phone)
 * body:
 *  - full_name: string
 *  - phone: string
 *  - email?: string
 *  - source?: string
 *  - course_class_id?: number|null
 *  - course_id?: number|null (optional)
 *  - note?: string
 */
app.post('/api/customers/register', async (req, res) => {
  try {
    const {
      full_name,
      phone,
      email,
      source,
      course_class_id,
      course_id,
      note
    } = req.body || {};

    if (!full_name || typeof full_name !== 'string') return sendError(res, 400, 'Missing full_name');
    if (!phone || typeof phone !== 'string') return sendError(res, 400, 'Missing phone');

    const src = source || 'website';

    // 1) upsert customer by phone
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

    // 2) insert registration
    const [insReg] = await db.query(
      `INSERT INTO registrations(
        customer_id, course_class_id, course_id, registration_type, note
      ) VALUES(
        :customer_id, :course_class_id, :course_id, 'register', :note
      )`,
      {
        customer_id: customerId,
        course_class_id: course_class_id || null,
        course_id: course_id || null,
        note: note || ''
      }
    );

    // 3) trả về
    res.json({ ok: true, registration_id: insReg.insertId, customer_id: customerId });
  } catch (e) {
    console.error(e);
    sendError(res, 500, 'Server error');
  }
});

/**
 * POST /api/customers/consult
 * Lưu tư vấn (callback / để lại số điện thoại / tư vấn khóa học)
 * body:
 *  - full_name: string
 *  - phone: string
 *  - email?: string
 *  - source?: string
 *  - course_id?: number|null
 *  - topic?: string
 *  - message?: string
 */
app.post('/api/customers/consult', async (req, res) => {
  try {
    const {
      full_name,
      phone,
      email,
      source,
      course_id,
      topic,
      message
    } = req.body || {};

    if (!full_name || typeof full_name !== 'string') return sendError(res, 400, 'Missing full_name');
    if (!phone || typeof phone !== 'string') return sendError(res, 400, 'Missing phone');

    const src = source || 'website';

    // upsert customer
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

    // insert consultation
    const [insCon] = await db.query(
      `INSERT INTO consultations(
        customer_id, course_id, topic, message, admin_status, admin_note
      ) VALUES(
        :customer_id, :course_id, :topic, :message, 'new', ''
      )`,
      {
        customer_id: customerId,
        course_id: course_id || null,
        topic: topic || '',
        message: message || ''
      }
    );

    res.json({ ok: true, consultation_id: insCon.insertId, customer_id: customerId });
  } catch (e) {
    console.error(e);
    sendError(res, 500, 'Server error');
  }
});

// ---- Public API (customer info) ----

/**
 * GET /api/customers/info?customer_id=X or ?phone=XXX
 * Lấy thông tin học viên (dùng cho trang hocvien.html)
 */
app.get('/api/customers/info', async (req, res) => {
  try {
    const customerId = req.query.customer_id ? Number(req.query.customer_id) : null;
    const phone = req.query.phone ? String(req.query.phone) : null;

    if (!customerId && !phone) {
      return sendError(res, 400, 'Missing customer_id or phone');
    }

    const sql = customerId
      ? 'SELECT id, full_name, phone, email, source, created_at, updated_at FROM customers WHERE id = :id LIMIT 1'
      : 'SELECT id, full_name, phone, email, source, created_at, updated_at FROM customers WHERE phone = :phone LIMIT 1';

    const params = customerId ? { id: customerId } : { phone };
    const [rows] = await db.query(sql, params);

    if (!rows.length) {
      return sendError(res, 404, 'Customer not found');
    }

    res.json({ ok: true, customer: rows[0] });
  } catch (e) {
    console.error(e);
    sendError(res, 500, 'Server error');
  }
});

/**
 * GET /api/customers/:id/registrations
 * Lấy danh sách khóa học đã đăng ký của học viên
 */
app.get('/api/customers/:id/registrations', async (req, res) => {
  try {
    const customerId = Number(req.params.id);
    if (!customerId) {
      return sendError(res, 400, 'Invalid customer_id');
    }

    const [rows] = await db.query(
      `SELECT
        r.id,
        r.customer_id,
        r.course_id,
        r.course_class_id,
        r.registration_type,
        r.note,
        r.admin_status,
        r.admin_note,
        r.created_at,
        r.updated_at
      FROM registrations r
      WHERE r.customer_id = :customer_id
      ORDER BY r.created_at DESC`,
      { customer_id: customerId }
    );

    res.json({ ok: true, registrations: rows });
  } catch (e) {
    console.error(e);
    sendError(res, 500, 'Server error');
  }
});

// ---- Public API (read courses/classes for frontend) ----

app.get('/api/courses', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, course_code, course_name, slug, description FROM courses WHERE is_active=1 ORDER BY course_code ASC'
    );
    res.json({ ok: true, courses: rows });
  } catch (e) {
    console.error(e);
    sendError(res, 500, 'Server error');
  }
});

app.get('/api/course-classes', async (req, res) => {
  try {
    const courseId = req.query.course_id ? Number(req.query.course_id) : null;
    const sql = courseId
      ? 'SELECT id, course_id, class_name, start_date, end_date, schedule_note, capacity, status FROM course_classes WHERE course_id=:course_id ORDER BY start_date ASC'
      : 'SELECT id, course_id, class_name, start_date, end_date, schedule_note, capacity, status FROM course_classes ORDER BY start_date ASC';

    const [rows] = courseId
      ? await db.query(sql, { course_id: courseId })
      : await db.query(sql);

    res.json({ ok: true, classes: rows });
  } catch (e) {
    console.error(e);
    sendError(res, 500, 'Server error');
  }
});

// ---- Admin APIs ----

/**
 * GET /api/admin/customers
 * Trả về danh sách học viên từ bảng customers
 */
app.get('/api/admin/customers', authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT
        id,
        full_name,
        phone,
        email,
        source,
        created_at,
        updated_at
      FROM customers
      ORDER BY created_at DESC
      LIMIT 1000`
    );

    res.json({ ok: true, customers: rows });
  } catch (e) {
    console.error(e);
    sendError(res, 500, 'Server error');
  }
});

/**
 * POST /api/admin/login
 * body: { username, password }
 * return: { ok:true, token, admin:{id,username,role} }
 */
app.post('/api/admin/login', async (req, res) => {
  try {
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
      ok: true,
      token,
      admin: { id: admin.id, username: admin.username, role: admin.role, full_name: admin.full_name }
    });
  } catch (e) {
    console.error(e);
    sendError(res, 500, 'Server error');
  }
});

/**
 * GET /api/admin/dashboard/overview
 * Trả thống kê đơn giản để dashboard dùng.
 */
app.get('/api/admin/dashboard/overview', authMiddleware, async (req, res) => {
  try {
    const [regNew] = await db.query(
      "SELECT COUNT(*) AS c FROM registrations WHERE admin_status='new'"
    );
    const [conNew] = await db.query(
      "SELECT COUNT(*) AS c FROM consultations WHERE admin_status='new'"
    );

    const [regInProgress] = await db.query(
      "SELECT COUNT(*) AS c FROM registrations WHERE admin_status='in_progress'"
    );

    const [coursesOpen] = await db.query(
      "SELECT COUNT(*) AS c FROM course_classes WHERE status='open'"
    );

    res.json({
      ok: true,
      overview: {
        registrations_new: regNew[0].c,
        consultations_new: conNew[0].c,
        registrations_in_progress: regInProgress[0].c,
        classes_open: coursesOpen[0].c
      }
    });
  } catch (e) {
    console.error(e);
    sendError(res, 500, 'Server error');
  }
});

/**
 * GET /api/admin/registrations?status=new
 */
app.get('/api/admin/registrations', authMiddleware, async (req, res) => {
  try {
    const status = req.query.status || 'new';
    const [rows] = await db.query(
      `SELECT
        r.id,
        r.created_at,
        r.admin_status,
        r.note,
        r.admin_note,
        c.full_name,
        c.phone,
        c.email,
        r.course_id,
        r.course_class_id
      FROM registrations r
      JOIN customers c ON c.id = r.customer_id
      WHERE r.admin_status = :status
      ORDER BY r.created_at DESC
      LIMIT 200`,
      { status }
    );

    res.json({ ok: true, registrations: rows });
  } catch (e) {
    console.error(e);
    sendError(res, 500, 'Server error');
  }
});

/**
 * GET /api/admin/students/registrations
 * Trả về toàn bộ học viên đã đăng ký (registrations) kèm thông tin từ customers
 */
app.get('/api/admin/students/registrations', authMiddleware, async (req, res) => {
  try {
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

        -- Resolve a human readable course label for dashboard badge
        CASE
          WHEN r.course_id IS NOT NULL THEN CONCAT('Hạng ', co.course_code)
          WHEN r.course_class_id IS NOT NULL THEN CONCAT('Lớp ', cc.class_name)
          ELSE 'N/A'
        END AS course_name
      FROM registrations r
      JOIN customers c ON c.id = r.customer_id
      LEFT JOIN courses co ON co.id = r.course_id
      LEFT JOIN course_classes cc ON cc.id = r.course_class_id
      ORDER BY r.created_at DESC
      LIMIT 1000`
    );

    res.json({ ok: true, registrations: rows });
  } catch (e) {
    console.error(e);
    sendError(res, 500, 'Server error');
  }
});

/**
 * POST /api/admin/registrations/:id/status
 * body: { admin_status, admin_note }
 */
app.post('/api/admin/registrations/:id/status', authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { admin_status, admin_note } = req.body || {};
    if (!id) return sendError(res, 400, 'Invalid id');
    if (!admin_status) return sendError(res, 400, 'Missing admin_status');

    await db.query(
      'UPDATE registrations SET admin_status=:admin_status, admin_note=:admin_note, updated_at=CURRENT_TIMESTAMP WHERE id=:id',
      { admin_status, admin_note: admin_note || '', id }
    );

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    sendError(res, 500, 'Server error');
  }
});

/**
 * GET /api/admin/consultations?status=new
 */
app.get('/api/admin/consultations', authMiddleware, async (req, res) => {
  try {
    const status = req.query.status || 'new';
    const [rows] = await db.query(
      `SELECT
        con.id,
        con.created_at,
        con.admin_status,
        con.topic,
        con.message,
        con.admin_note,
        c.full_name,
        c.phone,
        c.email,
        con.course_id
      FROM consultations con
      JOIN customers c ON c.id = con.customer_id
      WHERE con.admin_status = :status
      ORDER BY con.created_at DESC
      LIMIT 200`,
      { status }
    );

    res.json({ ok: true, consultations: rows });
  } catch (e) {
    console.error(e);
    sendError(res, 500, 'Server error');
  }
});

/**
 * POST /api/admin/consultations/:id/status
 * body: { admin_status, admin_note }
 */
app.post('/api/admin/consultations/:id/status', authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { admin_status, admin_note } = req.body || {};
    if (!id) return sendError(res, 400, 'Invalid id');
    if (!admin_status) return sendError(res, 400, 'Missing admin_status');

    await db.query(
      'UPDATE consultations SET admin_status=:admin_status, admin_note=:admin_note, updated_at=CURRENT_TIMESTAMP WHERE id=:id',
      { admin_status, admin_note: admin_note || '', id }
    );

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    sendError(res, 500, 'Server error');
  }
});

// ---- Debug (admin/dev only) ----
// Dùng để kiểm tra backend đang connect tới DB nào (warm server nào) và có thấy admin_users hay không.
app.get('/api/debug/db', async (req, res) => {
  try {
    // 1) lấy thông tin DB đang connect (host, user, database)
    const [dbInfoRows] = await db.query('SELECT DATABASE() AS db_name');
    const dbInfo = dbInfoRows?.[0] || {};

    // 2) đếm admin_users
    const [adminCountRows] = await db.query('SELECT COUNT(*) AS c FROM admin_users');
    const adminCount = adminCountRows?.[0]?.c ?? 0;

    // 3) lấy vài user admin (chỉ username để test)
    const [adminRows] = await db.query(
      'SELECT id, username, full_name, role, is_active FROM admin_users ORDER BY id ASC LIMIT 10'
    );

    // 4) lấy 1 số courses (để chắc chắn DB đã sync)
    const [courseRows] = await db.query(
      'SELECT course_code, course_name FROM courses ORDER BY id ASC LIMIT 5'
    );

    res.json({
      ok: true,
      config: {
        DB_HOST,
        DB_PORT,
        DB_USER,
        DB_NAME
      },
      connected: {
        current_db: dbInfo.db_name || DB_NAME,
        current_user: dbInfo.current_user || null
      },
      admin_users_count: adminCount,
      admins: adminRows,
      courses_sample: courseRows
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, message: 'Debug DB error', error: String(e?.message || e) });
  }
});

// ---- Healthcheck ----
app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
