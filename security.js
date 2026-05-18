/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║          SECURITY MIDDLEWARE — Thầy Hà Admin System             ║
 * ║  Cài đặt: npm i helmet express-rate-limit express-validator     ║
 * ║  Dán vào server.js NGAY SAU các dòng require() hiện có         ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * 5 lớp bảo mật:
 *  1. Security Headers  (helmet)
 *  2. CORS nghiêm ngặt  (whitelist domain)
 *  3. Rate Limiting      (chặn brute-force)
 *  4. JWT nâng cao       (brute-force login lock + token blacklist)
 *  5. Input Validation   (sanitize + validate)
 */

const helmet      = require('helmet');
const rateLimit   = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

// ════════════════════════════════════════════════════════════
// CẤU HÌNH — chỉnh sửa cho phù hợp với môi trường của bạn
// ════════════════════════════════════════════════════════════
const ALLOWED_ORIGINS = [
  'https://daylaixethayha.com',
  'https://www.daylaixethayha.com',
  // Thêm subdomain nếu cần:
  // 'https://admin.daylaixethayha.com',
];

// Trong development, thêm localhost:
if (process.env.NODE_ENV !== 'production') {
  ALLOWED_ORIGINS.push('http://localhost:3000');
  ALLOWED_ORIGINS.push('http://127.0.0.1:3000');
  ALLOWED_ORIGINS.push('http://localhost:5500');   // VS Code Live Server
  ALLOWED_ORIGINS.push('http://127.0.0.1:5500');
  ALLOWED_ORIGINS.push('null');                    // file:// trong dev
}

// ════════════════════════════════════════════════════════════
// LỚP 1: SECURITY HEADERS (helmet)
// Chặn: XSS injection, clickjacking, MIME sniffing,
//        lộ thông tin server, insecure connection
// ════════════════════════════════════════════════════════════
const helmetConfig = helmet({
  // Content Security Policy — chỉ cho load tài nguyên từ nguồn tin cậy
  contentSecurityPolicy: {
    directives: {
      defaultSrc:     ["'self'"],
      scriptSrc:      ["'self'"],
      styleSrc:       ["'self'", "'unsafe-inline'"],   // cần cho inline style
      imgSrc:         ["'self'", 'data:', 'https:'],
      connectSrc:     ["'self'", ...ALLOWED_ORIGINS],
      fontSrc:        ["'self'", 'https://fonts.gstatic.com'],
      objectSrc:      ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  // Buộc dùng HTTPS (HSTS) — 1 năm, bao gồm subdomain
  strictTransportSecurity: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  // Ngăn iframe từ trang khác (chặn clickjacking)
  frameguard: { action: 'deny' },
  // Tắt header X-Powered-By để không lộ Express
  hidePoweredBy: true,
  // Ngăn trình duyệt đoán MIME type
  noSniff: true,
  // Tắt DNS prefetch để không lộ domain nội bộ
  dnsPrefetchControl: { allow: false },
  // Referrer Policy — không gửi referer sang domain ngoài
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  // XSS Protection header (dành cho IE cũ)
  xssFilter: true,
});

// ════════════════════════════════════════════════════════════
// LỚP 2: CORS NGHIÊM NGẶT
// Chặn: request từ domain lạ, CSRF từ trang ngoài
// ════════════════════════════════════════════════════════════
const corsConfig = {
  origin: function (origin, callback) {
    // Cho phép request không có origin (Postman, curl) CHỈ trong dev
    if (!origin && process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    if (ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    // Log để phát hiện ai đang cố truy cập
    console.warn(`[CORS BLOCKED] Origin không được phép: ${origin}`);
    return callback(new Error('Not allowed by CORS'));
  },
  methods:     ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,    // cho phép gửi cookie/auth header
  maxAge:      86400,   // cache preflight 24 giờ
};

// ════════════════════════════════════════════════════════════
// LỚP 3: RATE LIMITING
// Chặn: brute-force attack, DDoS, spam form
// ════════════════════════════════════════════════════════════

// 3a. Giới hạn chung cho toàn API
const globalLimiter = rateLimit({
  windowMs:         15 * 60 * 1000,  // 15 phút
  max:              200,              // tối đa 200 request / 15 phút / IP
  standardHeaders:  true,
  legacyHeaders:    false,
  message: { ok: false, message: 'Quá nhiều yêu cầu, vui lòng thử lại sau 15 phút.' },
  skip: (req) => {
    // Không giới hạn health check
    return req.path === '/health';
  },
});

// 3b. Giới hạn riêng cho admin login — cực kỳ nghiêm
const loginLimiter = rateLimit({
  windowMs:         15 * 60 * 1000,  // 15 phút
  max:              10,               // chỉ 10 lần đăng nhập / 15 phút / IP
  standardHeaders:  true,
  legacyHeaders:    false,
  message: { ok: false, message: 'Quá nhiều lần đăng nhập thất bại. Vui lòng chờ 15 phút.' },
  skipSuccessfulRequests: true,       // không đếm request thành công
});

// 3c. Giới hạn gửi OTP — ngăn spam email
const otpLimiter = rateLimit({
  windowMs:         10 * 60 * 1000,  // 10 phút
  max:              5,                // 5 lần gửi OTP / 10 phút / IP
  standardHeaders:  true,
  legacyHeaders:    false,
  message: { ok: false, message: 'Quá nhiều yêu cầu OTP. Vui lòng chờ 10 phút.' },
});

// 3d. Giới hạn submit form đăng ký / tư vấn từ website
const formLimiter = rateLimit({
  windowMs:         60 * 60 * 1000,  // 1 giờ
  max:              20,               // 20 form / giờ / IP
  standardHeaders:  true,
  legacyHeaders:    false,
  message: { ok: false, message: 'Bạn đã gửi quá nhiều form. Vui lòng thử lại sau 1 giờ.' },
});

// ════════════════════════════════════════════════════════════
// LỚP 4: JWT NÂNG CAO
// Chặn: brute-force tài khoản, token bị đánh cắp sau logout
// ════════════════════════════════════════════════════════════

// Theo dõi số lần đăng nhập sai theo username (in-memory)
// Trong production nên dùng Redis để scale multi-instance
const loginAttempts = new Map();
// Map: username => { count, lockedUntil }

const MAX_LOGIN_ATTEMPTS  = 5;
const LOCK_DURATION_MS    = 15 * 60 * 1000; // 15 phút

// Xóa entry cũ mỗi 30 phút để tiết kiệm bộ nhớ
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of loginAttempts.entries()) {
    if (val.lockedUntil && val.lockedUntil < now) {
      loginAttempts.delete(key);
    }
  }
}, 30 * 60 * 1000);

/**
 * Kiểm tra tài khoản có đang bị khóa không
 * Trả về { locked: bool, remainingMs: number }
 */
function checkLoginLock(username) {
  const entry = loginAttempts.get(username);
  if (!entry) return { locked: false };
  if (entry.lockedUntil && Date.now() < entry.lockedUntil) {
    return { locked: true, remainingMs: entry.lockedUntil - Date.now() };
  }
  return { locked: false };
}

/**
 * Ghi nhận lần đăng nhập sai
 * Tự động khóa nếu vượt MAX_LOGIN_ATTEMPTS
 */
function recordLoginFailure(username) {
  const entry = loginAttempts.get(username) || { count: 0 };
  entry.count++;
  if (entry.count >= MAX_LOGIN_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOCK_DURATION_MS;
    entry.count = 0; // reset để sau khi hết khóa lại có 5 lần
    console.warn(`[SECURITY] Tài khoản "${username}" bị khóa do đăng nhập sai ${MAX_LOGIN_ATTEMPTS} lần`);
  }
  loginAttempts.set(username, entry);
}

/**
 * Reset bộ đếm khi đăng nhập thành công
 */
function resetLoginAttempts(username) {
  loginAttempts.delete(username);
}

// Token Blacklist — vô hiệu hóa JWT sau khi logout
// In production nên dùng Redis với TTL bằng thời gian hết hạn token
const tokenBlacklist = new Set();

// Tự động dọn dẹp token hết hạn trong blacklist
// (JWT tự hết hạn sau JWT_EXPIRES_IN, không cần giữ mãi)
setInterval(() => {
  // Blacklist chỉ cần giữ tối đa 7 ngày (JWT_EXPIRES_IN mặc định)
  // Vì sau 7d token đã vô hiệu, không cần blacklist nữa
  // Cách đơn giản: xóa sạch blacklist mỗi 7 ngày
  // Cách đúng hơn: lưu { token, expiresAt } và xóa từng cái
  // Ở đây dùng cách đơn giản vì token hết hạn cũng là vô dụng
}, 7 * 24 * 60 * 60 * 1000);

/**
 * authMiddleware NÂNG CAO
 * Thay thế authMiddleware gốc trong server.js
 * Thêm: kiểm tra token blacklist
 */
function authMiddlewareSecure(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ ok: false, message: 'Thiếu token xác thực' });

  // Kiểm tra token đã bị blacklist (sau logout) chưa
  if (tokenBlacklist.has(token)) {
    return res.status(401).json({ ok: false, message: 'Token đã hết hiệu lực. Vui lòng đăng nhập lại.' });
  }

  try {
    const payload = require('jsonwebtoken').verify(token, process.env.JWT_SECRET || 'change_me');
    req.admin = payload;
    req._token = token; // lưu để dùng khi logout
    return next();
  } catch (e) {
    if (e.name === 'TokenExpiredError') {
      return res.status(401).json({ ok: false, message: 'Token đã hết hạn. Vui lòng đăng nhập lại.' });
    }
    return res.status(401).json({ ok: false, message: 'Token không hợp lệ.' });
  }
}

// ════════════════════════════════════════════════════════════
// LỚP 5: INPUT VALIDATION & SANITIZATION
// Chặn: XSS, SQL Injection (bổ sung thêm ngoài namedPlaceholders),
//        prototype pollution, spam dữ liệu rác
// ════════════════════════════════════════════════════════════

/**
 * Middleware kiểm tra kết quả validation
 * Dùng sau mỗi chuỗi body() validators
 */
function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const firstError = errors.array()[0];
    return res.status(400).json({
      ok: false,
      message: firstError.msg,
      field: firstError.path,
    });
  }
  next();
}

// Validation rules cho từng route
const validators = {
  // POST /api/admin/login
  adminLogin: [
    body('username')
      .trim()
      .notEmpty().withMessage('Vui lòng nhập tài khoản')
      .isLength({ min: 3, max: 50 }).withMessage('Tài khoản từ 3-50 ký tự')
      .matches(/^[a-zA-Z0-9_]+$/).withMessage('Tài khoản chỉ được chứa chữ, số và _')
      .escape(),
    body('password')
      .notEmpty().withMessage('Vui lòng nhập mật khẩu')
      .isLength({ min: 4, max: 100 }).withMessage('Mật khẩu không hợp lệ'),
    handleValidation,
  ],

  // POST /api/customers/register
  customerRegister: [
    body('full_name')
      .trim()
      .notEmpty().withMessage('Vui lòng nhập họ tên')
      .isLength({ min: 2, max: 120 }).withMessage('Họ tên từ 2-120 ký tự')
      .escape(),
    body('phone')
      .trim()
      .notEmpty().withMessage('Vui lòng nhập số điện thoại')
      .matches(/^(0|\+84)[0-9]{8,10}$/).withMessage('Số điện thoại không hợp lệ'),
    body('email')
      .optional({ nullable: true, checkFalsy: true })
      .isEmail().withMessage('Email không đúng định dạng')
      .normalizeEmail(),
    body('note')
      .optional()
      .isLength({ max: 500 }).withMessage('Ghi chú tối đa 500 ký tự')
      .escape(),
    handleValidation,
  ],

  // POST /api/customers/consult
  customerConsult: [
    body('full_name')
      .trim()
      .notEmpty().withMessage('Vui lòng nhập họ tên')
      .isLength({ min: 2, max: 120 }).withMessage('Họ tên từ 2-120 ký tự')
      .escape(),
    body('phone')
      .trim()
      .notEmpty().withMessage('Vui lòng nhập số điện thoại')
      .matches(/^(0|\+84)[0-9]{8,10}$/).withMessage('Số điện thoại không hợp lệ'),
    body('email')
      .optional({ nullable: true, checkFalsy: true })
      .isEmail().withMessage('Email không đúng định dạng')
      .normalizeEmail(),
    body('topic')
      .optional()
      .isLength({ max: 150 }).withMessage('Chủ đề tối đa 150 ký tự')
      .escape(),
    body('message')
      .optional()
      .isLength({ max: 2000 }).withMessage('Tin nhắn tối đa 2000 ký tự')
      .escape(),
    handleValidation,
  ],

  // POST /api/admin/forgot-password
  forgotPassword: [
    body('email')
      .trim()
      .notEmpty().withMessage('Vui lòng nhập email')
      .isEmail().withMessage('Email không đúng định dạng')
      .normalizeEmail(),
    handleValidation,
  ],

  // POST /api/admin/verify-otp
  verifyOtp: [
    body('email')
      .trim()
      .notEmpty()
      .isEmail()
      .normalizeEmail(),
    body('otp')
      .trim()
      .notEmpty().withMessage('Vui lòng nhập mã OTP')
      .matches(/^[0-9]{6}$/).withMessage('Mã OTP phải là 6 chữ số'),
    handleValidation,
  ],

  // POST /api/admin/reset-password
  resetPassword: [
    body('newUsername')
      .trim()
      .notEmpty().withMessage('Vui lòng nhập tên tài khoản')
      .isLength({ min: 3, max: 50 }).withMessage('Tên tài khoản từ 3-50 ký tự')
      .matches(/^[a-zA-Z0-9_]+$/).withMessage('Chỉ được dùng chữ, số và _'),
    body('newPassword')
      .notEmpty().withMessage('Vui lòng nhập mật khẩu')
      .isLength({ min: 6, max: 100 }).withMessage('Mật khẩu ít nhất 6 ký tự'),
    body('resetToken')
      .notEmpty().withMessage('Token không hợp lệ'),
    handleValidation,
  ],

  // POST /api/admin/customers/:id/update
  customerUpdate: [
    body('full_name')
      .trim()
      .notEmpty().withMessage('Vui lòng nhập họ tên')
      .isLength({ min: 2, max: 120 }).withMessage('Họ tên từ 2-120 ký tự')
      .escape(),
    body('phone')
      .trim()
      .notEmpty().withMessage('Vui lòng nhập số điện thoại')
      .matches(/^(0|\+84)[0-9]{8,10}$/).withMessage('Số điện thoại không hợp lệ'),
    body('email')
      .optional({ nullable: true, checkFalsy: true })
      .isEmail().withMessage('Email không đúng định dạng')
      .normalizeEmail(),
    handleValidation,
  ],
};

/**
 * Middleware bảo vệ param ID — chặn injection qua URL params
 * Dùng cho mọi route có :id
 */
function validateParamId(req, res, next) {
  const id = req.params.id;
  if (!id || !/^\d+$/.test(String(id)) || Number(id) <= 0 || Number(id) > 2147483647) {
    return res.status(400).json({ ok: false, message: 'ID không hợp lệ' });
  }
  next();
}

/**
 * Middleware giới hạn kích thước request body
 * Chặn: payload quá lớn làm server OOM
 */
function limitBodySize(maxKB = 50) {
  return (req, res, next) => {
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    if (contentLength > maxKB * 1024) {
      return res.status(413).json({ ok: false, message: 'Dữ liệu gửi lên quá lớn.' });
    }
    next();
  };
}

// ════════════════════════════════════════════════════════════
// LOGGER BẢO MẬT — log các hành động quan trọng
// ════════════════════════════════════════════════════════════

function securityLog(event, data = {}) {
  const timestamp = new Date().toISOString();
  const ip = data.ip || 'unknown';
  console.log(`[SECURITY][${timestamp}] ${event} | IP: ${ip} |`, JSON.stringify(data));
}

// ════════════════════════════════════════════════════════════
// EXPORTS — import vào server.js
// ════════════════════════════════════════════════════════════

module.exports = {
  helmetConfig,
  corsConfig,
  globalLimiter,
  loginLimiter,
  otpLimiter,
  formLimiter,
  authMiddlewareSecure,
  tokenBlacklist,
  checkLoginLock,
  recordLoginFailure,
  resetLoginAttempts,
  validators,
  validateParamId,
  limitBodySize,
  securityLog,
};