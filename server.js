/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║        SERVER.JS — Thầy Hà Admin System (SECURED)               ║
 * ║  Yêu cầu: MySQL 8+, Node 18+                                    ║
 * ║  Cài đặt:                                                        ║
 * ║    npm i express mysql2 bcrypt jsonwebtoken cors dotenv          ║
 * ║        nodemailer helmet express-rate-limit express-validator    ║
 * ║  Chạy: node server.js                                           ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

'use strict';

// ============================================================
// ── DEPENDENCIES ─────────────────────────────────────────────
// ============================================================
const express    = require('express');
const mysql      = require('mysql2/promise');
const bcrypt     = require('bcrypt');
const jwt        = require('jsonwebtoken');
const cors       = require('cors');
const nodemailer = require('nodemailer');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

require('dotenv').config();

// ============================================================
// ── CONFIG ───────────────────────────────────────────────────
// ============================================================
const PORT         = Number(process.env.PORT          || 3000);
const DB_HOST      = process.env.DB_HOST              || 'localhost';
const DB_PORT      = Number(process.env.DB_PORT       || 3306);
const DB_USER      = process.env.DB_USER              || 'root';
const DB_PASSWORD  = process.env.DB_PASSWORD          || '';
const DB_NAME      = process.env.DB_NAME              || 'thayha_admin';
const JWT_SECRET   = process.env.JWT_SECRET           || 'CHANGE_ME_USE_RANDOM_32_CHARS';
const JWT_EXPIRES  = process.env.JWT_EXPIRES_IN       || '7d';
const NODE_ENV     = process.env.NODE_ENV             || 'development';
const IS_PROD      = NODE_ENV === 'production';

// Fallback email config (nên đặt trong .env)
if (!process.env.GMAIL_USER)         process.env.GMAIL_USER         = 'phuongnguyendai240@gmail.com';
if (!process.env.GMAIL_APP_PASSWORD) process.env.GMAIL_APP_PASSWORD = 'eqkqorwosrpodmbc';

// ============================================================
// ── APP INIT ─────────────────────────────────────────────────
// ============================================================
const app = express();

// Tin tưởng proxy đầu tiên (Nginx, Cloudflare) để lấy IP thật
app.set('trust proxy', 1);

// ============================================================
// ══ LỚP BẢO MẬT 1: SECURITY HEADERS (helmet) ════════════════
// Chặn: XSS, clickjacking, MIME sniffing, lộ thông tin server
// ============================================================
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:              ["'self'"],
      scriptSrc:               ["'self'"],
      styleSrc:                ["'self'", "'unsafe-inline'"],
      imgSrc:                  ["'self'", 'data:', 'https:'],
      connectSrc:              ["'self'"],
      fontSrc:                 ["'self'", 'https://fonts.gstatic.com'],
      objectSrc:               ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  strictTransportSecurity: { maxAge: 31536000, includeSubDomains: true, preload: true },
  frameguard:              { action: 'deny' },
  hidePoweredBy:           true,
  noSniff:                 true,
  dnsPrefetchControl:      { allow: false },
  referrerPolicy:          { policy: 'strict-origin-when-cross-origin' },
  xssFilter:               true,
}));

// ============================================================
// ══ LỚP BẢO MẬT 2: CORS NGHIÊM NGẶT ════════════════════════
// Chặn: request từ domain lạ, CSRF từ trang ngoài
// ============================================================
const ALLOWED_ORIGINS = [
  'https://daylaixethayha.com',
  'https://www.daylaixethayha.com',
];
if (!IS_PROD) {
  // Cho phép test local trong development
  ALLOWED_ORIGINS.push(
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'null',   // file:// open trong browser
  );
}

app.use(cors({
  origin(origin, cb) {
    if (!origin && !IS_PROD) return cb(null, true);  // Postman/curl trong dev
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    securityLog('CORS_BLOCKED', { origin });
    return cb(new Error('Not allowed by CORS'));
  },
  methods:        ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials:    true,
  maxAge:         86400,
}));

// ============================================================
// ══ LỚP BẢO MẬT 3: RATE LIMITING ════════════════════════════
// Chặn: brute-force, DDoS, spam form, spam OTP
// ============================================================

// 3a. Toàn cục: 200 req / 15 phút / IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 200,
  standardHeaders: true, legacyHeaders: false,
  message: { ok: false, message: 'Quá nhiều yêu cầu, vui lòng thử lại sau 15 phút.' },
  skip: req => req.path === '/health',
});

// 3b. Admin login: 10 req / 15 phút / IP (không đếm thành công)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10,
  standardHeaders: true, legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { ok: false, message: 'Quá nhiều lần đăng nhập thất bại. Vui lòng chờ 15 phút.' },
});

// 3c. OTP: 5 req / 10 phút / IP
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, max: 5,
  standardHeaders: true, legacyHeaders: false,
  message: { ok: false, message: 'Quá nhiều yêu cầu OTP. Vui lòng chờ 10 phút.' },
});

// 3d. Form công khai (đăng ký / tư vấn): 20 req / giờ / IP
const formLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 20,
  standardHeaders: true, legacyHeaders: false,
  message: { ok: false, message: 'Bạn đã gửi quá nhiều form. Vui lòng thử lại sau 1 giờ.' },
});

app.use(globalLimiter);

// ============================================================
// ── BODY PARSER (giới hạn kích thước chặn payload bomb) ─────
// ============================================================
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// ── Timeout ──────────────────────────────────────────────────
app.use((req, res, next) => {
  req.setTimeout(30000);
  res.setTimeout(30000);
  next();
});

// ============================================================
// ── DATABASE POOL ────────────────────────────────────────────
// ============================================================
let db;
async function initDb() {
  db = await mysql.createPool({
    host: DB_HOST, port: DB_PORT,
    user: DB_USER, password: DB_PASSWORD, database: DB_NAME,
    waitForConnections: true, connectionLimit: 10, queueLimit: 0,
    namedPlaceholders: true,
    enableKeepAlive: true, keepAliveInitialDelayMs: 0,
  });
  db.on('error', err => {
    console.error('[DB] Pool error:', err);
    setTimeout(() => initDb().catch(e => console.error('[DB] Reconnect failed:', e)), 5000);
  });
  db.on('connection', () => console.log('[DB] New connection established'));
}
initDb().catch(err => { console.error('[DB] Init error:', err); process.exit(1); });

// ============================================================
// ── HELPERS ──────────────────────────────────────────────────
// ============================================================
function sendError(res, status, message, details) {
  res.status(status).json({ ok: false, message, details: details || null });
}

const asyncHandler = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

function securityLog(event, data = {}) {
  console.log(`[SECURITY][${new Date().toISOString()}] ${event} |`, JSON.stringify(data));
}

// ============================================================
// ══ LỚP BẢO MẬT 4: JWT NÂNG CAO ═════════════════════════════
// Chặn: brute-force tài khoản, dùng lại token sau logout
// ============================================================

// 4a. Brute-force lock theo username (in-memory)
//     Production: dùng Redis thay Map để scale multi-instance
const loginAttempts  = new Map();
const MAX_ATTEMPTS   = 5;
const LOCK_MS        = 15 * 60 * 1000;

// Dọn dẹp entry hết hạn mỗi 30 phút
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of loginAttempts.entries()) {
    if (v.lockedUntil && v.lockedUntil < now) loginAttempts.delete(k);
  }
}, 30 * 60 * 1000);

function checkLoginLock(username) {
  const e = loginAttempts.get(username);
  if (!e) return { locked: false };
  if (e.lockedUntil && Date.now() < e.lockedUntil)
    return { locked: true, remainingMs: e.lockedUntil - Date.now() };
  return { locked: false };
}

function recordLoginFailure(username) {
  const e = loginAttempts.get(username) || { count: 0 };
  e.count++;
  if (e.count >= MAX_ATTEMPTS) {
    e.lockedUntil = Date.now() + LOCK_MS;
    e.count = 0;
    securityLog('ACCOUNT_LOCKED', { username });
  }
  loginAttempts.set(username, e);
}

function resetLoginAttempts(username) {
  loginAttempts.delete(username);
}

// 4b. Token blacklist sau logout (in-memory)
//     Production: dùng Redis với TTL = thời gian còn lại của token
const tokenBlacklist = new Set();

// 4c. authMiddleware nâng cao
function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ ok: false, message: 'Thiếu token xác thực' });

  if (tokenBlacklist.has(token))
    return res.status(401).json({ ok: false, message: 'Token đã hết hiệu lực. Vui lòng đăng nhập lại.' });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.admin  = payload;
    req._token = token;
    return next();
  } catch (e) {
    const msg = e.name === 'TokenExpiredError'
      ? 'Token đã hết hạn. Vui lòng đăng nhập lại.'
      : 'Token không hợp lệ.';
    return res.status(401).json({ ok: false, message: msg });
  }
}

// ============================================================
// ══ LỚP BẢO MẬT 5: INPUT VALIDATION & SANITIZATION ══════════
// Chặn: XSS, injection, dữ liệu rác, prototype pollution
// ============================================================
function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const first = errors.array()[0];
    return res.status(400).json({ ok: false, message: first.msg, field: first.path });
  }
  next();
}

const V = {
  adminLogin: [
    body('username').trim().notEmpty().withMessage('Vui lòng nhập tài khoản')
      .isLength({ min: 3, max: 50 }).withMessage('Tài khoản từ 3-50 ký tự')
      .matches(/^[a-zA-Z0-9_]+$/).withMessage('Tài khoản chỉ được chứa chữ, số và _').escape(),
    body('password').notEmpty().withMessage('Vui lòng nhập mật khẩu')
      .isLength({ min: 4, max: 100 }).withMessage('Mật khẩu không hợp lệ'),
    handleValidation,
  ],

  customerRegister: [
    body('full_name').trim().notEmpty().withMessage('Vui lòng nhập họ tên')
      .isLength({ min: 2, max: 120 }).withMessage('Họ tên từ 2-120 ký tự').escape(),
    body('phone').trim().notEmpty().withMessage('Vui lòng nhập số điện thoại')
      .matches(/^(0|\+84)[0-9]{8,10}$/).withMessage('Số điện thoại không hợp lệ'),
    body('email').optional({ nullable: true, checkFalsy: true })
      .isEmail().withMessage('Email không đúng định dạng').normalizeEmail(),
    body('note').optional().isLength({ max: 500 }).withMessage('Ghi chú tối đa 500 ký tự').escape(),
    handleValidation,
  ],

  customerConsult: [
    body('full_name').trim().notEmpty().withMessage('Vui lòng nhập họ tên')
      .isLength({ min: 2, max: 120 }).withMessage('Họ tên từ 2-120 ký tự').escape(),
    body('phone').trim().notEmpty().withMessage('Vui lòng nhập số điện thoại')
      .matches(/^(0|\+84)[0-9]{8,10}$/).withMessage('Số điện thoại không hợp lệ'),
    body('email').optional({ nullable: true, checkFalsy: true })
      .isEmail().withMessage('Email không đúng định dạng').normalizeEmail(),
    body('topic').optional().isLength({ max: 150 }).withMessage('Chủ đề tối đa 150 ký tự').escape(),
    body('message').optional().isLength({ max: 2000 }).withMessage('Tin nhắn tối đa 2000 ký tự').escape(),
    handleValidation,
  ],

  forgotPassword: [
    body('email').trim().notEmpty().withMessage('Vui lòng nhập email')
      .isEmail().withMessage('Email không đúng định dạng').normalizeEmail(),
    handleValidation,
  ],

  verifyOtp: [
    body('email').trim().notEmpty().isEmail().normalizeEmail(),
    body('otp').trim().notEmpty().withMessage('Vui lòng nhập mã OTP')
      .matches(/^[0-9]{6}$/).withMessage('Mã OTP phải là 6 chữ số'),
    handleValidation,
  ],

  resetPassword: [
    body('newUsername').trim().notEmpty().withMessage('Vui lòng nhập tên tài khoản')
      .isLength({ min: 3, max: 50 }).withMessage('Tên tài khoản từ 3-50 ký tự')
      .matches(/^[a-zA-Z0-9_]+$/).withMessage('Chỉ được dùng chữ, số và _'),
    body('newPassword').notEmpty().withMessage('Vui lòng nhập mật khẩu')
      .isLength({ min: 6, max: 100 }).withMessage('Mật khẩu ít nhất 6 ký tự'),
    body('resetToken').notEmpty().withMessage('Token không hợp lệ'),
    handleValidation,
  ],

  customerUpdate: [
    body('full_name').trim().notEmpty().withMessage('Vui lòng nhập họ tên')
      .isLength({ min: 2, max: 120 }).withMessage('Họ tên từ 2-120 ký tự').escape(),
    body('phone').trim().notEmpty().withMessage('Vui lòng nhập số điện thoại')
      .matches(/^(0|\+84)[0-9]{8,10}$/).withMessage('Số điện thoại không hợp lệ'),
    body('email').optional({ nullable: true, checkFalsy: true })
      .isEmail().withMessage('Email không đúng định dạng').normalizeEmail(),
    handleValidation,
  ],
};

// Bảo vệ URL param :id — chặn injection qua URL
function validateParamId(req, res, next) {
  const id = req.params.id;
  if (!id || !/^\d+$/.test(String(id)) || Number(id) <= 0 || Number(id) > 2147483647)
    return res.status(400).json({ ok: false, message: 'ID không hợp lệ' });
  next();
}

// ============================================================
// ── EMAIL (nodemailer) ───────────────────────────────────────
// ============================================================
function createTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  });
}

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function buildEmailHTML(otp, adminName) {
  return `<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Xác nhận OTP - Thầy Hà</title></head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa;padding:30px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(11,31,74,0.10);">
        <tr><td style="background:linear-gradient(135deg,#0b1f4a,#163a80);padding:32px 40px;text-align:center;">
          <div style="font-size:2rem;font-weight:800;color:#fff;letter-spacing:1px;">🚗 Thầy Hà</div>
          <div style="color:rgba(255,255,255,0.75);font-size:0.85rem;margin-top:6px;text-transform:uppercase;letter-spacing:2px;">Trung tâm Đào tạo lái xe</div>
        </td></tr>
        <tr><td style="padding:36px 40px;">
          <h2 style="margin:0 0 8px;color:#0b1f4a;font-size:1.4rem;">Đặt lại mật khẩu</h2>
          <p style="color:#6c7a8a;margin:0 0 28px;font-size:0.95rem;">
            Xin chào <strong style="color:#0b1f4a;">${adminName}</strong>,<br>
            Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản admin của bạn.
          </p>
          <div style="background:#f0f4ff;border:2px dashed #3a6bd4;border-radius:12px;padding:28px;text-align:center;margin-bottom:28px;">
            <div style="color:#6c7a8a;font-size:0.85rem;text-transform:uppercase;letter-spacing:2px;margin-bottom:12px;">Mã xác nhận OTP</div>
            <div style="font-size:2.8rem;font-weight:800;letter-spacing:12px;color:#0b1f4a;font-family:'Courier New',monospace;">${otp}</div>
            <div style="color:#e84040;font-size:0.82rem;margin-top:12px;">⏱ Mã có hiệu lực trong <strong>10 phút</strong></div>
          </div>
          <div style="background:#fff8f0;border-left:4px solid #f4782a;border-radius:6px;padding:14px 16px;margin-bottom:24px;">
            <div style="color:#856404;font-size:0.85rem;">⚠️ <strong>Lưu ý bảo mật:</strong> Không chia sẻ mã OTP này với bất kỳ ai.</div>
          </div>
          <p style="color:#aab4c0;font-size:0.82rem;margin:0;">Email này được gửi tự động. Vui lòng không trả lời.</p>
        </td></tr>
        <tr><td style="background:#f8f9fc;padding:18px 40px;border-top:1px solid #e8edf5;text-align:center;">
          <div style="color:#aab4c0;font-size:0.78rem;">© 2026 Thầy Hà - Đào tạo lái xe ĐH An Ninh TP.HCM<br>km18 Song Hành Xa Lộ Hà Nội · 0941 822 239</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

// OTP Store: email => { otp, adminId, username, fullName, expires }
const otpStore = new Map();

// Dọn OTP hết hạn mỗi 5 phút
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of otpStore.entries()) {
    if (v.expires < now) otpStore.delete(k);
  }
}, 5 * 60 * 1000);

// ============================================================
// ══════════════════════════════════════════════════════════════
//                         ROUTES
// ══════════════════════════════════════════════════════════════
// ============================================================

// ── Health check ─────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ ok: true }));

// ============================================================
// ── PUBLIC: FORM ĐĂNG KÝ KHÓA HỌC ───────────────────────────
// ============================================================
app.post(
  '/api/customers/register',
  formLimiter,
  ...V.customerRegister,
  asyncHandler(async (req, res) => {
    const { full_name, phone, email, source, course_class_id, course_id, note } = req.body;
    const src = source || 'website';

    const [existing] = await db.query(
      'SELECT id FROM customers WHERE phone = :phone LIMIT 1', { phone }
    );
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
  })
);

// ── PUBLIC: FORM TƯ VẤN ──────────────────────────────────────
app.post(
  '/api/customers/consult',
  formLimiter,
  ...V.customerConsult,
  asyncHandler(async (req, res) => {
    const { full_name, phone, email, source, course_id, course_code, topic, message } = req.body;
    const src = source || 'website';
    let selectedCourseId = null;

    if (course_id) {
      selectedCourseId = Number(course_id) || null;
    } else if (course_code) {
      const [cr] = await db.query(
        'SELECT id FROM courses WHERE course_code = :course_code LIMIT 1', { course_code }
      );
      if (cr.length) selectedCourseId = cr[0].id;
    }

    const [existing] = await db.query(
      'SELECT id FROM customers WHERE phone = :phone LIMIT 1', { phone }
    );
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
  })
);

// ── PUBLIC: Tra cứu thông tin khách hàng ─────────────────────
app.get('/api/customers/info', asyncHandler(async (req, res) => {
  const customerId = req.query.customer_id ? Number(req.query.customer_id) : null;
  const phone      = req.query.phone ? String(req.query.phone).trim() : null;
  if (!customerId && !phone) return sendError(res, 400, 'Missing customer_id or phone');

  // Validate tham số query
  if (phone && !/^(0|\+84)[0-9]{8,10}$/.test(phone))
    return sendError(res, 400, 'Số điện thoại không hợp lệ');
  if (customerId && (isNaN(customerId) || customerId <= 0))
    return sendError(res, 400, 'customer_id không hợp lệ');

  const sql    = customerId
    ? 'SELECT id, full_name, phone, email, source, created_at, updated_at FROM customers WHERE id = :id LIMIT 1'
    : 'SELECT id, full_name, phone, email, source, created_at, updated_at FROM customers WHERE phone = :phone LIMIT 1';
  const params = customerId ? { id: customerId } : { phone };
  const [rows] = await db.query(sql, params);
  if (!rows.length) return sendError(res, 404, 'Customer not found');
  res.json({ ok: true, customer: rows[0] });
}));

app.get('/api/customers/:id/registrations', validateParamId, asyncHandler(async (req, res) => {
  const customerId = Number(req.params.id);
  const [rows] = await db.query(
    `SELECT r.id, r.customer_id, r.course_id, r.course_class_id, r.registration_type,
            r.note, r.admin_status, r.admin_note, r.created_at, r.updated_at
     FROM registrations r WHERE r.customer_id = :customer_id ORDER BY r.created_at DESC`,
    { customer_id: customerId }
  );
  res.json({ ok: true, registrations: rows });
}));

app.get('/api/courses', asyncHandler(async (_req, res) => {
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
// ── ADMIN: ĐĂNG NHẬP ─────────────────────────────────────────
// ============================================================
app.post(
  '/api/admin/login',
  loginLimiter,
  ...V.adminLogin,
  asyncHandler(async (req, res) => {
    const { username, password } = req.body;

    // Kiểm tra tài khoản bị khóa
    const lock = checkLoginLock(username);
    if (lock.locked) {
      const minutes = Math.ceil(lock.remainingMs / 60000);
      securityLog('LOGIN_LOCKED', { ip: req.ip, username });
      return sendError(res, 429,
        `Tài khoản bị tạm khóa do đăng nhập sai nhiều lần. Vui lòng thử lại sau ${minutes} phút.`
      );
    }

    const [rows] = await db.query(
      'SELECT id, username, password_hash, full_name, role, is_active FROM admin_users WHERE username=:username LIMIT 1',
      { username }
    );

    // Luôn trả lỗi chung, không tiết lộ "tài khoản không tồn tại"
    if (!rows.length) {
      recordLoginFailure(username);
      securityLog('LOGIN_FAIL', { ip: req.ip, username, reason: 'not_found' });
      return sendError(res, 401, 'Tài khoản hoặc mật khẩu không đúng');
    }

    const admin = rows[0];
    if (admin.is_active !== 1) {
      securityLog('LOGIN_FAIL', { ip: req.ip, username, reason: 'inactive' });
      return sendError(res, 403, 'Tài khoản đã bị vô hiệu hóa');
    }

    const match = await bcrypt.compare(password, admin.password_hash);
    if (!match) {
      recordLoginFailure(username);
      securityLog('LOGIN_FAIL', { ip: req.ip, username, reason: 'wrong_pw' });
      return sendError(res, 401, 'Tài khoản hoặc mật khẩu không đúng');
    }

    resetLoginAttempts(username);
    securityLog('LOGIN_SUCCESS', { ip: req.ip, username });

    const token = jwt.sign(
      { id: admin.id, username: admin.username, role: admin.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    res.json({
      ok: true, token,
      admin: { id: admin.id, username: admin.username, role: admin.role, full_name: admin.full_name },
    });
  })
);

// ── ADMIN: ĐĂNG XUẤT (blacklist token) ───────────────────────
app.post('/api/admin/logout', authMiddleware, asyncHandler(async (req, res) => {
  if (req._token) {
    tokenBlacklist.add(req._token);
    securityLog('LOGOUT', { ip: req.ip, username: req.admin?.username });
  }
  res.json({ ok: true, message: 'Đã đăng xuất thành công.' });
}));

// ── ADMIN: DASHBOARD OVERVIEW ────────────────────────────────
app.get('/api/admin/dashboard/overview', authMiddleware, asyncHandler(async (_req, res) => {
  const [[regNew]]       = await db.query("SELECT COUNT(*) AS c FROM registrations WHERE admin_status='new'");
  const [[conNew]]       = await db.query("SELECT COUNT(*) AS c FROM consultations WHERE admin_status='new'");
  const [[regInProgress]]= await db.query("SELECT COUNT(*) AS c FROM registrations WHERE admin_status='in_progress'");
  const [[coursesOpen]]  = await db.query("SELECT COUNT(*) AS c FROM course_classes WHERE status='open'");
  res.json({
    ok: true,
    overview: {
      registrations_new:       regNew.c,
      consultations_new:       conNew.c,
      registrations_in_progress: regInProgress.c,
      classes_open:            coursesOpen.c,
    },
  });
}));

// ── ADMIN: DANH SÁCH KHÁCH HÀNG ──────────────────────────────
app.get('/api/admin/customers', authMiddleware, asyncHandler(async (_req, res) => {
  const [rows] = await db.query(
    `SELECT id, full_name, phone, email, source, created_at, updated_at
     FROM customers ORDER BY created_at DESC LIMIT 1000`
  );
  res.json({ ok: true, customers: rows });
}));

// ── ADMIN: CẬP NHẬT KHÁCH HÀNG ───────────────────────────────
app.post(
  '/api/admin/customers/:id/update',
  authMiddleware, validateParamId, ...V.customerUpdate,
  asyncHandler(async (req, res) => {
    const customerId = Number(req.params.id);
    const { full_name, phone, email } = req.body;

    const [custRows] = await db.query(
      'SELECT id FROM customers WHERE id = :id LIMIT 1', { id: customerId }
    );
    if (!custRows.length) return sendError(res, 404, 'Customer not found');

    await db.query(
      'UPDATE customers SET full_name=:full_name, phone=:phone, email=:email, updated_at=CURRENT_TIMESTAMP WHERE id=:id',
      { full_name, phone, email: email || null, id: customerId }
    );
    res.json({ ok: true });
  })
);

// ── ADMIN: XÓA KHÁCH HÀNG ────────────────────────────────────
app.post(
  '/api/admin/customers/:id/delete',
  authMiddleware, validateParamId,
  asyncHandler(async (req, res) => {
    const customerId = Number(req.params.id);
    let conn;
    try {
      conn = await db.getConnection();
      await conn.beginTransaction();

      const [custRows] = await conn.query(
        'SELECT id FROM customers WHERE id = :id LIMIT 1', { id: customerId }
      );
      if (!custRows.length) {
        await conn.rollback(); conn.release();
        return sendError(res, 404, 'Customer not found');
      }

      await conn.query('DELETE FROM attendance        WHERE customer_id = :id', { id: customerId });
      await conn.query('DELETE FROM class_enrollment  WHERE customer_id = :id', { id: customerId });
      await conn.query('DELETE FROM notifications     WHERE customer_id = :id', { id: customerId });
      await conn.query('DELETE FROM payments          WHERE customer_id = :id', { id: customerId });
      await conn.query('DELETE FROM consultations     WHERE customer_id = :id', { id: customerId });
      await conn.query('DELETE FROM registrations     WHERE customer_id = :id', { id: customerId });
      await conn.query('DELETE FROM customers         WHERE id = :id',          { id: customerId });

      await conn.commit(); conn.release();
      securityLog('DELETE_CUSTOMER', { customerId, by: req.admin?.username });
      res.json({ ok: true });
    } catch (e) {
      console.error('Delete customer error:', e);
      if (conn) { try { await conn.rollback(); } catch (_) {} try { conn.release(); } catch (_) {} }
      return sendError(res, 500, 'Server error', IS_PROD ? null : e?.message);
    }
  })
);

// ── ADMIN: DANH SÁCH ĐĂNG KÝ (lọc theo status) ───────────────
app.get('/api/admin/registrations', authMiddleware, asyncHandler(async (req, res) => {
  const status = req.query.status || 'new';
  const VALID_STATUS = ['new','contacted','in_progress','enrolled','completed','rejected'];
  if (!VALID_STATUS.includes(status)) return sendError(res, 400, 'Trạng thái không hợp lệ');

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

// ── ADMIN: TẤT CẢ ĐĂNG KÝ (có tên khóa học) ─────────────────
app.get('/api/admin/students/registrations', authMiddleware, asyncHandler(async (_req, res) => {
  const [rows] = await db.query(
    `SELECT r.id AS registration_id, r.created_at, r.admin_status, r.note, r.admin_note,
            c.id AS customer_id, c.full_name, c.phone, c.email, c.source AS customer_source,
            r.course_id, r.course_class_id,
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

// ── ADMIN: CẬP NHẬT TRẠNG THÁI ĐĂNG KÝ ──────────────────────
app.post(
  '/api/admin/registrations/:id/status',
  authMiddleware, validateParamId,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { admin_status, admin_note } = req.body || {};

    const VALID_STATUS = ['new','contacted','in_progress','enrolled','completed','rejected'];
    if (!admin_status || !VALID_STATUS.includes(admin_status))
      return sendError(res, 400, 'Trạng thái không hợp lệ');

    await db.query(
      'UPDATE registrations SET admin_status=:admin_status, admin_note=:admin_note, updated_at=CURRENT_TIMESTAMP WHERE id=:id',
      { admin_status, admin_note: String(admin_note || '').slice(0, 500), id }
    );
    res.json({ ok: true });
  })
);

// ── ADMIN: XÓA ĐĂNG KÝ ───────────────────────────────────────
app.post(
  '/api/admin/registrations/:id/delete',
  authMiddleware, validateParamId,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    let conn;
    try {
      conn = await db.getConnection();
      await conn.beginTransaction();

      const [regRows] = await conn.query(
        'SELECT id, customer_id FROM registrations WHERE id = :id LIMIT 1', { id }
      );
      if (!regRows.length) {
        await conn.rollback(); conn.release();
        return sendError(res, 404, 'Registration not found');
      }
      const customerId = regRows[0].customer_id;

      await conn.query('DELETE FROM registrations WHERE id = :id', { id });

      // Xóa customer nếu không còn dữ liệu liên quan nào
      const [[remReg]] = await conn.query(
        'SELECT COUNT(*) AS c FROM registrations WHERE customer_id = :customer_id', { customer_id: customerId }
      );
      if (Number(remReg.c) === 0) {
        const [[remCon]] = await conn.query(
          'SELECT COUNT(*) AS c FROM consultations WHERE customer_id = :customer_id', { customer_id: customerId }
        );
        if (Number(remCon.c) === 0) {
          await conn.query('DELETE FROM payments        WHERE customer_id = :customer_id', { customer_id: customerId });
          await conn.query('DELETE FROM attendance      WHERE customer_id = :customer_id', { customer_id: customerId });
          await conn.query('DELETE FROM class_enrollment WHERE customer_id = :customer_id', { customer_id: customerId });
          await conn.query('DELETE FROM notifications   WHERE customer_id = :customer_id', { customer_id: customerId });
          await conn.query('DELETE FROM customers       WHERE id = :id',                   { id: customerId });
        }
      }

      await conn.commit(); conn.release();
      res.json({ ok: true });
    } catch (e) {
      console.error('Delete registration error:', e);
      if (conn) { try { await conn.rollback(); } catch (_) {} try { conn.release(); } catch (_) {} }
      return sendError(res, 500, 'Server error', IS_PROD ? null : e?.message);
    }
  })
);

// ── ADMIN: DANH SÁCH TƯ VẤN ─────────────────────────────────
app.get('/api/admin/consultations', authMiddleware, asyncHandler(async (req, res) => {
  const status = req.query.status || 'all';
  const VALID  = ['all','new','contacted','scheduled','completed','closed'];
  if (!VALID.includes(status)) return sendError(res, 400, 'Trạng thái không hợp lệ');

  const params = {};
  const where  = status !== 'all' ? 'WHERE con.admin_status = :status' : '';
  if (status !== 'all') params.status = status;

  const [rows] = await db.query(
    `SELECT con.id, con.created_at, con.updated_at, con.admin_status, con.topic, con.message,
            con.admin_note, c.full_name, c.phone, c.email, con.course_id,
            cr.course_name, cr.course_code
     FROM consultations con
     JOIN customers c ON c.id = con.customer_id
     LEFT JOIN courses cr ON cr.id = con.course_id
     ${where}
     ORDER BY con.created_at DESC LIMIT 200`,
    params
  );
  res.json({ ok: true, consultations: rows });
}));

// ── ADMIN: CẬP NHẬT TƯ VẤN (đầy đủ) ─────────────────────────
app.put(
  '/api/admin/consultations/:id',
  authMiddleware, validateParamId,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { full_name, phone, email, course_code, topic, message, admin_status, admin_note } = req.body || {};

    if (!full_name || typeof full_name !== 'string' || full_name.trim().length < 2)
      return sendError(res, 400, 'Họ tên không hợp lệ');
    if (!phone || !/^(0|\+84)[0-9]{8,10}$/.test(phone.trim()))
      return sendError(res, 400, 'Số điện thoại không hợp lệ');

    const [conRows] = await db.query(
      'SELECT customer_id FROM consultations WHERE id = :id LIMIT 1', { id }
    );
    if (!conRows.length) return sendError(res, 404, 'Consultation not found');
    const customerId = conRows[0].customer_id;

    await db.query(
      'UPDATE customers SET full_name=:full_name, phone=:phone, email=:email, updated_at=CURRENT_TIMESTAMP WHERE id=:id',
      { full_name: full_name.trim(), phone: phone.trim(), email: email || null, id: customerId }
    );

    let newCourseId = null;
    if (course_code) {
      const [cr] = await db.query('SELECT id FROM courses WHERE course_code = :course_code LIMIT 1', { course_code });
      if (cr.length) newCourseId = cr[0].id;
    }

    const VALID_STATUS = ['new','contacted','scheduled','completed','closed'];
    const safeStatus   = VALID_STATUS.includes(admin_status) ? admin_status : 'new';

    await db.query(
      `UPDATE consultations
       SET course_id=:course_id, topic=:topic, message=:message,
           admin_status=:admin_status, admin_note=:admin_note, updated_at=CURRENT_TIMESTAMP
       WHERE id=:id`,
      {
        course_id:    newCourseId,
        topic:        String(topic || 'Tư vấn khóa học').slice(0, 150),
        message:      String(message || '').slice(0, 2000),
        admin_status: safeStatus,
        admin_note:   String(admin_note || '').slice(0, 500),
        id,
      }
    );
    res.json({ ok: true });
  })
);

// ── ADMIN: CẬP NHẬT TRẠNG THÁI TƯ VẤN ───────────────────────
app.post(
  '/api/admin/consultations/:id/status',
  authMiddleware, validateParamId,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { admin_status, admin_note } = req.body || {};

    const VALID = ['new','contacted','scheduled','completed','closed'];
    if (!admin_status || !VALID.includes(admin_status))
      return sendError(res, 400, 'Trạng thái không hợp lệ');

    await db.query(
      'UPDATE consultations SET admin_status=:admin_status, admin_note=:admin_note, updated_at=CURRENT_TIMESTAMP WHERE id=:id',
      { admin_status, admin_note: String(admin_note || '').slice(0, 500), id }
    );
    res.json({ ok: true });
  })
);

// ============================================================
// ── FORGOT PASSWORD: 3 bước (email → OTP → reset) ───────────
// ============================================================

// Bước 1: Gửi OTP
app.post(
  '/api/admin/forgot-password',
  otpLimiter,
  ...V.forgotPassword,
  asyncHandler(async (req, res) => {
    const normalizedEmail = req.body.email.trim().toLowerCase();

    // Rate limit thêm theo email (1 lần / 60 giây)
    if (otpStore.has(normalizedEmail)) {
      const existing    = otpStore.get(normalizedEmail);
      const secondsAgo  = (Date.now() - (existing.expires - 10 * 60 * 1000)) / 1000;
      if (secondsAgo < 60)
        return sendError(res, 429, `Vui lòng chờ ${Math.ceil(60 - secondsAgo)} giây trước khi gửi lại`);
    }

    const [rows] = await db.query(
      'SELECT id, username, full_name, email, is_active FROM admin_users WHERE LOWER(email) = :email LIMIT 1',
      { email: normalizedEmail }
    );

    // Luôn trả ok=true để không lộ email có tồn tại không
    if (!rows.length || rows[0].is_active !== 1) {
      return res.json({ ok: true, message: 'Nếu email tồn tại, mã OTP sẽ được gửi trong vài giây.' });
    }

    const admin = rows[0];
    const otp   = generateOTP();

    otpStore.set(normalizedEmail, {
      otp, adminId: admin.id, username: admin.username,
      fullName: admin.full_name, expires: Date.now() + 10 * 60 * 1000,
    });

    try {
      const transporter = createTransporter();
      await transporter.sendMail({
        from:    `"Thầy Hà - Admin System" <${process.env.GMAIL_USER}>`,
        to:      admin.email,
        subject: `[Thầy Hà] Mã OTP đặt lại mật khẩu: ${otp}`,
        html:    buildEmailHTML(otp, admin.full_name),
      });
    } catch (mailErr) {
      console.error('[EMAIL] Send error:', mailErr);
      otpStore.delete(normalizedEmail);
      return sendError(res, 500, 'Không thể gửi email. Kiểm tra cấu hình GMAIL trong .env');
    }

    // Chỉ log OTP trong dev, không bao giờ log trong production
    if (!IS_PROD) console.log(`[OTP-DEV] ${admin.username}: ${otp}`);
    res.json({ ok: true, message: 'Nếu email tồn tại, mã OTP sẽ được gửi trong vài giây.' });
  })
);

// Bước 2: Xác minh OTP → trả resetToken
app.post(
  '/api/admin/verify-otp',
  otpLimiter,
  ...V.verifyOtp,
  asyncHandler(async (req, res) => {
    const normalizedEmail = req.body.email.trim().toLowerCase();
    const { otp }         = req.body;
    const record          = otpStore.get(normalizedEmail);

    if (!record)
      return sendError(res, 400, 'Mã OTP không hợp lệ hoặc đã hết hạn');
    if (Date.now() > record.expires) {
      otpStore.delete(normalizedEmail);
      return sendError(res, 400, 'Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới');
    }
    if (String(otp).trim() !== record.otp)
      return sendError(res, 400, 'Mã OTP không đúng');

    const resetToken = jwt.sign(
      { adminId: record.adminId, email: normalizedEmail, purpose: 'reset_password' },
      JWT_SECRET,
      { expiresIn: '5m' }
    );

    otpStore.delete(normalizedEmail); // OTP dùng 1 lần
    securityLog('OTP_VERIFIED', { email: normalizedEmail });

    res.json({
      ok: true, resetToken,
      username: record.username, fullName: record.fullName,
      message: 'OTP hợp lệ. Bạn có 5 phút để đặt lại mật khẩu.',
    });
  })
);

// Bước 3: Đặt lại mật khẩu
app.post(
  '/api/admin/reset-password',
  ...V.resetPassword,
  asyncHandler(async (req, res) => {
    const { resetToken, newUsername, newPassword } = req.body;

    let payload;
    try {
      payload = jwt.verify(resetToken, JWT_SECRET);
    } catch (e) {
      return sendError(res, 401, 'Token hết hạn hoặc không hợp lệ. Vui lòng bắt đầu lại');
    }
    if (payload.purpose !== 'reset_password')
      return sendError(res, 401, 'Token không hợp lệ');

    const adminId = payload.adminId;

    const [dupRows] = await db.query(
      'SELECT id FROM admin_users WHERE username = :username AND id != :id LIMIT 1',
      { username: newUsername, id: adminId }
    );
    if (dupRows.length)
      return sendError(res, 409, 'Tên tài khoản đã tồn tại. Vui lòng chọn tên khác');

    const passwordHash = await bcrypt.hash(newPassword, 12); // cost 12 thay vì 10

    await db.query(
      'UPDATE admin_users SET username = :username, password_hash = :hash, updated_at = CURRENT_TIMESTAMP WHERE id = :id',
      { username: newUsername, hash: passwordHash, id: adminId }
    );

    securityLog('PASSWORD_RESET', { adminId, newUsername });
    res.json({ ok: true, message: 'Đặt lại mật khẩu thành công! Bạn có thể đăng nhập với tài khoản mới.' });
  })
);

// ============================================================
// ── GLOBAL ERROR HANDLER ─────────────────────────────────────
// ============================================================
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  // Lỗi CORS
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ ok: false, message: 'CORS: Origin không được phép' });
  }
  console.error('[ERROR]', err);
  // Không trả stack trace trong production
  res.status(500).json({
    ok: false,
    message: 'Internal server error',
    ...(IS_PROD ? {} : { details: err.message }),
  });
});

// 404 handler
app.use((_req, res) => res.status(404).json({ ok: false, message: 'Route không tồn tại' }));

// ============================================================
// ── PROCESS EVENTS ───────────────────────────────────────────
// ============================================================
process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[UNCAUGHT EXCEPTION]', error);
});

async function gracefulShutdown(signal) {
  console.log(`[SERVER] ${signal} received — shutting down gracefully...`);
  server.close(async () => {
    console.log('[SERVER] HTTP server closed');
    if (db) {
      try { await db.end(); console.log('[DB] Pool closed'); }
      catch (e) { console.error('[DB] Close error:', e); }
    }
    process.exit(0);
  });
  // Force kill nếu sau 10 giây vẫn chưa tắt được
  setTimeout(() => { console.error('[SERVER] Forced shutdown'); process.exit(1); }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

// ============================================================
// ── START ────────────────────────────────────────────────────
// ============================================================
const server = app.listen(PORT, () => {
  console.log(`[SERVER] Running on http://localhost:${PORT}`);
  console.log(`[SERVER] Environment : ${NODE_ENV}`);
  console.log(`[SERVER] Database    : ${DB_HOST}:${DB_PORT}/${DB_NAME}`);
  if (!IS_PROD) {
    console.log('[SERVER] ⚠️  DEVELOPMENT MODE — CORS mở rộng, debug info hiển thị');
  }
});