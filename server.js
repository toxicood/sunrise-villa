/* Sunrise Villa — tiny Node.js server with a JSON booking store.
   No dependencies. Run with: node server.js */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const VIEWS = path.join(ROOT, 'views');
const DATA_DIR = path.join(ROOT, 'data');
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'sunrise@2026';
const ADMIN_PASSWORD_HASH = crypto.createHash('sha256').update(String(ADMIN_PASSWORD)).digest();
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const COOKIE_NAME = 'sv_admin';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

const ROOMS = {
  premier: { name: 'Premier Double', price: 2200, capacity: 2, label: '₹2,200 / night' },
  deluxe: { name: 'Deluxe Double', price: 1800, capacity: 2, label: '₹1,800 / night' },
  family: { name: 'Family Room', price: 2600, capacity: 4, label: '₹2,600 / night' },
  cozy: { name: 'Cozy Double', price: 1499, capacity: 2, label: '₹1,499 / night' },
  any: { name: 'Not sure — help me choose', price: 0, capacity: 4, label: 'Best rate' },
};

/* ---------------- data store ---------------- */

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  ['bookings.json', 'messages.json'].forEach((file) => {
    const file_ = path.join(DATA_DIR, file);
    if (!fs.existsSync(file_)) fs.writeFileSync(file_, '[]');
  });
}

function readJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
  } catch (error) {
    return [];
  }
}

function writeJSON(file, data) {
  const target = path.join(DATA_DIR, file);
  const temp = `${target}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(data, null, 2));
  fs.renameSync(temp, target);
}

ensureDataDir();

/* ---------------- helpers ---------------- */

function parseBody(req, limit = 200000) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > limit) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function sendJSON(res, status, payload, headers = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(body);
}

function readHTML(name) {
  return fs.readFileSync(path.join(VIEWS, name), 'utf8');
}

function renderPage(page, active) {
  const html = readHTML(page);
  return html
    .replace(/\{\{HEADER\}\}/g, renderHeader(active))
    .replace(/\{\{FOOTER\}\}/g, renderFooter())
    .replace(/\{\{YEAR\}\}/g, String(new Date().getFullYear()));
}

function navLink(href, label, active) {
  const isActive = active === href ? ' class="is-active" aria-current="page"' : '';
  return `<a href="${href}"${isActive}>${label}</a>`;
}

function renderHeader(active) {
  return `
  <header class="site-header" data-header>
    <div class="container header-inner">
      <a class="brand" href="/" aria-label="Sunrise Villa home">
        <img class="brand-logo" src="/assets/images/logo.svg" alt="" width="64" height="64">
        <span class="brand-copy">
          <strong>Sunrise Villa</strong>
          <span>Lebong · Darjeeling</span>
        </span>
      </a>
      <nav class="main-nav" id="main-nav" aria-label="Main navigation">
        ${navLink('/', 'Home', active)}
        ${navLink('/rooms.html', 'Rooms', active)}
        ${navLink('/gallery.html', 'Gallery', active)}
        ${navLink('/about.html', 'About', active)}
        ${navLink('/contact.html', 'Contact', active)}
        ${navLink('/book.html', 'Book', active)}
      </nav>
      <div class="header-actions">
        <a class="header-phone" href="tel:+919832233086">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
          <span>98322 33086</span>
        </a>
        <a class="btn btn-small btn-primary header-book" href="/book.html">Book your stay</a>
        <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="main-nav" aria-label="Open menu" data-nav-toggle>
          <span></span><span></span><span></span>
        </button>
      </div>
    </div>
  </header>`;
}

function renderFooter() {
  return `
  <footer class="site-footer">
    <div class="container footer-main">
      <div class="footer-brand">
        <a class="brand brand-footer" href="/" aria-label="Sunrise Villa home">
          <img class="brand-logo" src="/assets/images/logo.svg" alt="" width="78" height="78">
          <span class="brand-copy">
            <strong>Sunrise Villa</strong>
            <span>Lebong · Darjeeling</span>
          </span>
        </a>
        <p>A simple, family-run homestay in the quiet lanes of Lebong. Come for the mountain air; stay for the warm welcome.</p>
      </div>
      <div class="footer-links">
        <h3>Explore</h3>
        <a href="/">Home</a>
        <a href="/rooms.html">Rooms</a>
        <a href="/gallery.html">Gallery</a>
        <a href="/contact.html">Contact</a>
        <a href="/book.html">Book a stay</a>
      </div>
      <div class="footer-links">
        <h3>Reach us</h3>
        <a href="tel:+919832233086">+91 98322 33086</a>
        <a href="tel:+918972745152">+91 89727 45152</a>
        <a href="mailto:stay@sunrisevilladarjeeling.in">stay@sunrisevilladarjeeling.in</a>
        <a href="https://wa.me/919832233086" target="_blank" rel="noopener">WhatsApp</a>
      </div>
      <div class="footer-visit">
        <h3>Visit</h3>
        <address>Golai Bazar, Lebong<br>Darjeeling, West Bengal<br>India</address>
        <a class="footer-map-link" href="https://www.google.com/maps/search/?api=1&amp;query=Sunrise+Villa+Golai+Bazar+Lebong+Darjeeling" target="_blank" rel="noopener">Get directions <span aria-hidden="true">↗</span></a>
      </div>
    </div>
    <div class="container footer-bottom">
      <span>© {{YEAR}} Sunrise Villa. All rights reserved.</span>
      <span><a href="/admin.html">Owner login</a></span>
    </div>
  </footer>
  <a class="whatsapp-float" href="https://wa.me/919832233086?text=Hello%20Sunrise%20Villa!%20I%20would%20like%20to%20ask%20about%20a%20room." target="_blank" rel="noopener" aria-label="Chat with Sunrise Villa on WhatsApp">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z"/></svg>
    <span>Chat with us</span>
  </a>
  <dialog class="lightbox" data-lightbox-dialog aria-label="Photo viewer">
    <button class="lightbox-close" type="button" aria-label="Close photo" data-lightbox-close>×</button>
    <button class="lightbox-nav lightbox-prev" type="button" aria-label="Previous photo" data-lightbox-prev>‹</button>
    <figure>
      <img src="" alt="" data-lightbox-image>
      <figcaption data-lightbox-caption></figcaption>
    </figure>
    <button class="lightbox-nav lightbox-next" type="button" aria-label="Next photo" data-lightbox-next>›</button>
  </dialog>
  <script src="/assets/js/main.js"></script>`;
}

/* ---------------- static files ---------------- */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};

function serveStatic(req, res, pathname) {
  const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(ROOT, safePath);
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  fs.stat(filePath, (error, stats) => {
    if (error || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Not found');
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': pathname.startsWith('/assets/') ? 'public, max-age=3600' : 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(filePath).pipe(res);
  });
}

/* ---------------- admin auth ---------------- */

function parseCookies(req) {
  const header = req.headers.cookie || '';
  return header.split(';').reduce((acc, part) => {
    const index = part.indexOf('=');
    if (index > -1) acc[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
    return acc;
  }, {});
}

function createToken() {
  const expires = Date.now() + SESSION_TTL_MS;
  const payload = Buffer.from(`${expires}.${crypto.randomBytes(8).toString('hex')}`).toString('base64url');
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return false;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  const decoded = Buffer.from(payload, 'base64url').toString('utf8');
  const expires = Number(decoded.split('.')[0]);
  return Number.isFinite(expires) && expires > Date.now();
}

function isAdmin(req) {
  return verifyToken(parseCookies(req)[COOKIE_NAME]);
}

const loginAttempts = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  const attempts = loginAttempts.get(ip) || { count: 0, first: now };
  if (now - attempts.first > 10 * 60 * 1000) {
    attempts.count = 0;
    attempts.first = now;
  }
  attempts.count += 1;
  loginAttempts.set(ip, attempts);
  return attempts.count > 8;
}

/* ---------------- booking helpers ---------------- */

function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function nightsBetween(a, b) {
  const start = new Date(a);
  const end = new Date(b);
  return Math.round((end - start) / 86400000);
}

function makeReference() {
  const now = new Date();
  const stamp = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  return `SV-${stamp}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function overlapsConfirmed(bookings, roomId, checkin, checkout) {
  return bookings.some((booking) =>
    booking.status === 'confirmed' &&
    booking.roomId === roomId &&
    checkin < booking.checkout &&
    checkout > booking.checkin
  );
}

/* ---------------- API routes ---------------- */

async function handleAPI(req, res, url, ip) {
  const { pathname } = url;

  if (req.method === 'POST' && pathname === '/api/bookings') {
    let body;
    try {
      body = await parseBody(req);
    } catch (error) {
      return sendJSON(res, 400, { error: 'Invalid request body.' });
    }

    const roomId = body.roomId;
    const checkin = String(body.checkin || '').trim();
    const checkout = String(body.checkout || '').trim();
    const adults = Number(body.adults);
    const children = Number(body.children || 0);
    const name = String(body.name || '').trim();
    const phone = String(body.phone || '').trim();
    const email = String(body.email || '').trim();
    const notes = String(body.notes || '').trim();

    if (!ROOMS[roomId]) return sendJSON(res, 400, { error: 'Please choose a valid room.' });
    if (!isValidDate(checkin) || !isValidDate(checkout)) {
      return sendJSON(res, 400, { error: 'Please provide valid check-in and check-out dates.' });
    }
    const nights = nightsBetween(checkin, checkout);
    if (nights < 1 || nights > 30) {
      return sendJSON(res, 400, { error: 'Your stay must be between 1 and 30 nights.' });
    }
    if (!Number.isFinite(adults) || adults < 1 || adults > 10) {
      return sendJSON(res, 400, { error: 'Please enter a valid number of adults.' });
    }
    if (!Number.isFinite(children) || children < 0 || children > 6) {
      return sendJSON(res, 400, { error: 'Please enter a valid number of children.' });
    }
    if (name.length < 2) return sendJSON(res, 400, { error: 'Please enter your full name.' });
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length < 10 || phoneDigits.length > 13) {
      return sendJSON(res, 400, { error: 'Please enter a valid mobile number.' });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return sendJSON(res, 400, { error: 'Please enter a valid email address or leave it blank.' });
    }

    const bookings = readJSON('bookings.json');
    if (roomId !== 'any' && overlapsConfirmed(bookings, roomId, checkin, checkout)) {
      return sendJSON(res, 409, {
        error: 'That room is already confirmed for these dates. Please choose different dates or another room, or call us.',
      });
    }

    const room = ROOMS[roomId];
    const reference = makeReference();
    const booking = {
      id: crypto.randomUUID(),
      reference,
      roomId,
      roomName: room.name,
      pricePerNight: room.price,
      checkin,
      checkout,
      nights,
      adults,
      children,
      total: room.price ? room.price * nights : null,
      name,
      phone,
      email: email || null,
      notes: notes || null,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    bookings.push(booking);
    writeJSON('bookings.json', bookings);
    return sendJSON(res, 201, { booking });
  }

  if (req.method === 'GET' && pathname === '/api/bookings') {
    if (!isAdmin(req)) return sendJSON(res, 401, { error: 'Not authorised.' });
    const bookings = readJSON('bookings.json').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const stats = {
      total: bookings.length,
      pending: bookings.filter((b) => b.status === 'pending').length,
      confirmed: bookings.filter((b) => b.status === 'confirmed').length,
      cancelled: bookings.filter((b) => b.status === 'cancelled').length,
      revenue: bookings.filter((b) => b.status === 'confirmed').reduce((sum, b) => sum + (b.total || 0), 0),
    };
    return sendJSON(res, 200, { bookings, stats });
  }

  if (req.method === 'PATCH' && pathname.startsWith('/api/bookings/')) {
    if (!isAdmin(req)) return sendJSON(res, 401, { error: 'Not authorised.' });
    const id = pathname.split('/').pop();
    let body;
    try {
      body = await parseBody(req);
    } catch (error) {
      return sendJSON(res, 400, { error: 'Invalid request body.' });
    }
    const status = body.status;
    if (!['pending', 'confirmed', 'cancelled'].includes(status)) {
      return sendJSON(res, 400, { error: 'Invalid status.' });
    }
    const bookings = readJSON('bookings.json');
    const booking = bookings.find((b) => b.id === id);
    if (!booking) return sendJSON(res, 404, { error: 'Booking not found.' });
    booking.status = status;
    booking.updatedAt = new Date().toISOString();
    writeJSON('bookings.json', bookings);
    return sendJSON(res, 200, { booking });
  }

  if (req.method === 'DELETE' && pathname.startsWith('/api/bookings/')) {
    if (!isAdmin(req)) return sendJSON(res, 401, { error: 'Not authorised.' });
    const id = pathname.split('/').pop();
    const bookings = readJSON('bookings.json');
    const index = bookings.findIndex((b) => b.id === id);
    if (index === -1) return sendJSON(res, 404, { error: 'Booking not found.' });
    bookings.splice(index, 1);
    writeJSON('bookings.json', bookings);
    return sendJSON(res, 200, { ok: true });
  }

  if (req.method === 'POST' && pathname === '/api/messages') {
    let body;
    try {
      body = await parseBody(req);
    } catch (error) {
      return sendJSON(res, 400, { error: 'Invalid request body.' });
    }
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim();
    const phone = String(body.phone || '').trim();
    const message = String(body.message || '').trim();
    if (name.length < 2 || message.length < 5) {
      return sendJSON(res, 400, { error: 'Please enter your name and a short message.' });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return sendJSON(res, 400, { error: 'Please enter a valid email address.' });
    }
    const messages = readJSON('messages.json');
    messages.push({
      id: crypto.randomUUID(),
      name,
      email: email || null,
      phone: phone || null,
      message,
      createdAt: new Date().toISOString(),
    });
    writeJSON('messages.json', messages);
    return sendJSON(res, 201, { ok: true });
  }

  if (req.method === 'POST' && pathname === '/api/admin/login') {
    if (isRateLimited(ip)) return sendJSON(res, 429, { error: 'Too many attempts. Try again in a few minutes.' });
    let body;
    try {
      body = await parseBody(req);
    } catch (error) {
      return sendJSON(res, 400, { error: 'Invalid request body.' });
    }
    const user = String(body.username || '').trim();
    const password = String(body.password || '');
    const userHash = crypto.createHash('sha256').update(user).digest();
    const passwordHash = crypto.createHash('sha256').update(password).digest();
    const expectedUser = crypto.createHash('sha256').update(ADMIN_USER).digest();
    const userOk = crypto.timingSafeEqual(userHash, expectedUser);
    const passwordOk = crypto.timingSafeEqual(passwordHash, ADMIN_PASSWORD_HASH);
    if (!userOk || !passwordOk) return sendJSON(res, 401, { error: 'Incorrect username or password.' });
    const token = createToken();
    res.setHeader('Set-Cookie', `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_MS / 1000}`);
    return sendJSON(res, 200, { ok: true });
  }

  if (req.method === 'POST' && pathname === '/api/admin/logout') {
    res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
    return sendJSON(res, 200, { ok: true });
  }

  if (req.method === 'GET' && pathname === '/api/admin/session') {
    return sendJSON(res, 200, { authenticated: isAdmin(req) });
  }

  return sendJSON(res, 404, { error: 'API route not found.' });
}

/* ---------------- server ---------------- */

const server = http.createServer(async (req, res) => {
  const ip = (req.socket.remoteAddress || 'unknown').replace('::ffff:', '');
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(url.pathname);

  try {
    if (pathname.startsWith('/api/')) {
      return await handleAPI(req, res, url, ip);
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' });
      return res.end('Method not allowed');
    }

    if (pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
      return res.end(renderPage('home.html', '/'));
    }

    if (['/index.html', '/home'].includes(pathname)) {
      res.writeHead(301, { Location: '/' });
      return res.end();
    }

    const pageRoutes = {
      '/rooms.html': 'rooms.html',
      '/gallery.html': 'gallery.html',
      '/about.html': 'about.html',
      '/contact.html': 'contact.html',
      '/book.html': 'book.html',
      '/admin.html': 'admin.html',
    };
    if (pageRoutes[pathname]) {
      const active = pathname === '/about.html' ? '/about.html' : pathname;
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
      return res.end(renderPage(pageRoutes[pathname], active));
    }

    if (pathname === '/health') {
      return sendJSON(res, 200, { ok: true });
    }

    return serveStatic(req, res, pathname);
  } catch (error) {
    console.error(error);
    return sendJSON(res, 500, { error: 'Something went wrong.' });
  }
});

server.on('clientError', (err, socket) => {
  if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

process.on('uncaughtException', (err) => {
  console.error('Recovered from error:', err.message);
});

server.listen(PORT, HOST, () => {
  console.log(`Sunrise Villa server running at http://${HOST}:${PORT}`);
});
