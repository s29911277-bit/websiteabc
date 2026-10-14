/* BorrowBox data layer. localStorage is the browser cache; save() also
   synchronizes shared collections with the PostgreSQL API. */

const COLLEGE_DOMAIN = 'kristujayanti.com';
const API_BASE = window.BORROWBOX_API ||
  (['localhost', '127.0.0.1'].includes(location.hostname) ? 'http://localhost:3000' : location.origin);
const API_TOKEN = window.BORROWBOX_API_KEY || localStorage.getItem('bb_api_token') || 'borrowbox-demo-key';
try { localStorage.setItem('bb_api_token', API_TOKEN); } catch (e) { /* ignore */ }
const ADMIN_LOGIN = { email: 'admin@gmail.com', password: 'admin@123' };
const MAX_LOAN_DAYS = 14;
const SEED_VERSION = 1;

const CATEGORIES = [
  { name: 'Books',            emoji: '📚', art: 'books',      tone: 'sage'   },
  { name: 'Calculators',      emoji: '🧮', art: 'calculator', tone: 'lime'   },
  { name: 'Electronics',      emoji: '🔌', art: 'charger',    tone: 'sky'    },
  { name: 'Lab Equipment',    emoji: '🥼', art: 'flask',      tone: 'butter' },
  { name: 'Study Materials',  emoji: '📐', art: 'drafter',    tone: 'blush'  },
  { name: 'Sports Equipment', emoji: '🏸', art: 'racket',     tone: 'peach'  },
  { name: 'Umbrellas',        emoji: '☂️', art: 'umbrella',   tone: 'sky'    },
  { name: 'Art Supplies',     emoji: '🎨', art: 'palette',    tone: 'blush'  },
  { name: 'Power Banks',      emoji: '🔋', art: 'powerbank',  tone: 'lime'   },
  { name: 'Other',            emoji: '📦', art: 'box',        tone: 'sage'   }
];
const CONDITIONS = ['Like new', 'Good', 'Fair'];
const LOCATIONS = ['Block 1', 'Block 2', 'Block 3', 'Block 4', 'Library', 'Main Canteen',
                   'Hostel A', 'Hostel B', 'Sports Complex', 'Main Gate'];

const KEY = {
  users: 'bb_users', items: 'bb_items', requests: 'bb_requests', history: 'bb_history',
  reports: 'bb_reports', session: 'bb_session', seeded: 'bb_seeded', userSeeds: 'bb_user_seeds'
};

/* ---------- storage ---------- */
function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) { return fallback; }
}
function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    if ([KEY.users, KEY.items, KEY.requests, KEY.history, KEY.reports].includes(key)) queueSharedSave();
    return true;
  }
  catch (e) { return false; }   // storage full or blocked
}
function drop(key) { try { localStorage.removeItem(key); } catch (e) { /* ignore */ } }

let sharedSaveTimer;
function authHeaders(extra = {}) {
  const headers = { ...extra };
  if (API_TOKEN) headers.Authorization = `Bearer ${API_TOKEN}`;
  return headers;
}

function queueSharedSave() {
  clearTimeout(sharedSaveTimer);
  sharedSaveTimer = setTimeout(async () => {
    const state = {
      users: getUsers(), items: getItems(), requests: getRequests(),
      history: getHistory(), reports: getReports()
    };
    try {
      const response = await fetch(`${API_BASE}/api/state`, {
        method: 'PUT', headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ state })
      });
      if (!response.ok) throw new Error(`API returned ${response.status}`);
    } catch (error) {
      console.warn('Could not save shared PostgreSQL data:', error.message);
    }
  }, 200);
}

const getUsers    = () => load(KEY.users, {});
const getItems    = () => load(KEY.items, []);
const getRequests = () => load(KEY.requests, []);
const getHistory  = () => load(KEY.history, []);
const getReports  = () => load(KEY.reports, []);
const setUsers    = v => save(KEY.users, v);
const setItems    = v => save(KEY.items, v);
const setRequests = v => save(KEY.requests, v);
const setHistory  = v => save(KEY.history, v);
const setReports  = v => save(KEY.reports, v);

/* ---------- dates (always stored as YYYY-MM-DD) ---------- */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function toISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function parseISO(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function today() { return toISO(new Date()); }
function addDays(n, from) {
  const d = from ? parseISO(from) : new Date();
  d.setDate(d.getDate() + n);
  return toISO(d);
}
function daysBetween(a, b) { return Math.round((parseISO(b) - parseISO(a)) / 86400000); }
function fmtDate(s) {
  if (!s) return '–';
  const d = parseISO(s);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}
function maxDate(a, b) { return a > b ? a : b; }
function minDate(a, b) { return a < b ? a : b; }

/* ---------- small helpers ---------- */
function uid(prefix) { return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function shortHash(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h.toString(36); }
function E(key) { return `${key}@${COLLEGE_DOMAIN}`; }
function catOf(name) { return CATEGORIES.find(c => c.name === name) || CATEGORIES[CATEGORIES.length - 1]; }

/* ---------- session ---------- */
const getSession = () => load(KEY.session, null);
function setSession(user) { save(KEY.session, { email: user.email, name: user.name }); }
function clearSession() { drop(KEY.session); }

/* ---------- lookups ---------- */
const userOf = email => getUsers()[email];
const displayName = email => (userOf(email) || {}).name || 'Former member';
const getItem = id => getItems().find(i => i.id === id);

/* A borrowing that is past its due date is shown as Overdue. */
function effectiveStatus(req) {
  return req.status === 'Borrowed' && req.borrowUntil < today() ? 'Overdue' : req.status;
}
function activeRequestFor(itemId) {
  return getRequests().find(r => r.itemId === itemId && (r.status === 'Accepted' || r.status === 'Borrowed'));
}

/* ---------- seeding ---------- */
function initData() {
  if (load(KEY.seeded, 0) !== SEED_VERSION) {
    seedCommunity();
    save(KEY.seeded, SEED_VERSION);
  }
}

/* Builds one request (and, for returned ones, the matching history row). */
function seedRequest(ctx, itemId, borrowerId, fromOff, untilOff, status, opts = {}) {
  const it = ctx.items.find(i => i.id === itemId);
  const req = {
    id: uid('r'), itemId, borrowerId, ownerId: it.ownerId,
    requestDate: addDays(fromOff - 1), borrowFrom: addDays(fromOff), borrowUntil: addDays(untilOff),
    note: opts.note || '', status, createdAt: addDays(fromOff - 1)
  };
  if (status === 'Returned') {
    const returned = addDays(opts.returnOff !== undefined ? opts.returnOff : untilOff);
    req.returnedAt = returned;
    ctx.history.push({
      id: uid('h'), itemId, borrowerId, ownerId: it.ownerId,
      borrowDate: req.borrowFrom, dueDate: req.borrowUntil, returnDate: returned,
      status: returned > req.borrowUntil ? 'Returned late' : 'Returned'
    });
  }
  if (status === 'Declined') req.respondedAt = addDays(fromOff);
  ctx.requests.push(req);
}

function seedCommunity() {
  const people = [
    ['aarav',   'Aarav Nair',     'BCA · 2nd year'],
    ['meera',   'Meera Iyer',     'BCA · 3rd year'],
    ['karthik', 'Karthik Shetty', 'BSc Computer Science · 2nd year'],
    ['sneha',   'Sneha Pillai',   'BCom · 1st year'],
    ['isha',    'Isha Menon',     'BSc Chemistry · 2nd year'],
    ['divya',   'Divya Gowda',    'BCA · 1st year'],
    ['dev',     'Dev Patel',      'BBA · 3rd year'],
    ['imran',   'Imran Khan',     'BCom · 2nd year'],
    ['rohan',   'Rohan Das',      'BSc Physics · 3rd year'],
    ['ananya',  'Ananya Rao',     'BCA · 2nd year']
  ];
  const users = getUsers();
  people.forEach(([k, name, dept], i) => {
    users[E(k)] = { name, email: E(k), password: null, role: 'student', dept, joined: addDays(-90 + i * 6), suspended: false };
  });
  setUsers(users);

  const mk = (id, owner, name, category, condition, location, description, extra = {}) => ({
    id, ownerId: E(owner), name, category, description, condition, photo: null, location,
    availability: 'Available', availableFrom: addDays(-5), availableUntil: addDays(60), createdAt: addDays(-25), ...extra
  });
  const items = [
    mk('i1',  'karthik', 'Casio Scientific Calculator', 'Calculators', 'Like new', 'Block 3',
       'Casio fx-991EX with natural display and 552 functions. Allowed in most internal exams. Comes with its cover and fresh batteries.'),
    mk('i2',  'sneha',   'Texas Instruments TI-30XS', 'Calculators', 'Good', 'Library',
       'Multi-view scientific calculator, good for statistics and maths papers. Small scratch on the cover, display is clear.',
       { availability: 'Borrowed' }),
    mk('i3',  'imran',   'Basic Calculator', 'Calculators', 'Fair', 'Main Canteen',
       '12-digit desk calculator. Good for quick sums and accounting practicals. The keys are a little worn but all work.'),
    mk('i4',  'aarav',   'Operating System Concepts', 'Books', 'Good', 'Library',
       'Silberschatz, 10th edition. Light highlighting in chapters 3 to 6, no torn pages.'),
    mk('i5',  'isha',    'White Lab Coat (M)', 'Lab Equipment', 'Good', 'Block 3',
       'Full-sleeve cotton lab coat, size M, washed after every use. Suitable for chemistry and physics practicals.', { art: 'coat' }),
    mk('i6',  'divya',   'Folding Umbrella', 'Umbrellas', 'Good', 'Main Gate',
       'Compact automatic umbrella with a strong frame. Fits in a bag. Please return it dry.'),
    mk('i7',  'dev',     'Ambrane 20000mAh Power Bank', 'Power Banks', 'Good', 'Hostel A',
       'Two USB outputs and one Type-C port. Holds about four phone charges. Cable included.'),
    mk('i8',  'meera',   '65W USB-C Laptop Charger', 'Electronics', 'Like new', 'Block 1',
       'Works with most USB-C laptops and phones. Handy for a day when yours is left at home.', { availability: 'Borrowed' }),
    mk('i9',  'rohan',   'Yonex Badminton Racket and Shuttles', 'Sports Equipment', 'Good', 'Sports Complex',
       'One racket with cover and a tube of five feather shuttles. Court booking is not included.'),
    mk('i10', 'ananya',  'Engineering Drawing Set', 'Study Materials', 'Good', 'Block 2',
       'Mini drafter, two set squares, a compass and a protractor in a hard case. Pencils not included.', { availability: 'Borrowed' }),
    mk('i11', 'sneha',   'Watercolour Palette and Brushes', 'Art Supplies', 'Good', 'Block 4',
       '24-colour palette with three round brushes. Most colours are unused.'),
    mk('i12', 'karthik', 'Arduino Uno Starter Kit', 'Electronics', 'Fair', 'Block 3',
       'Uno board, breadboard, jumper wires, LEDs and resistors. The ultrasonic sensor is missing.', { availability: 'Reserved' }),
    mk('i13', 'divya',   'Data Structures Using C', 'Books', 'Good', 'Block 2',
       'Clean copy with solved examples marked in the margins for stacks and trees.')
  ];

  const ctx = { items, requests: [], history: [] };
  [
    ['i1',  'aarav',   -27, -24], ['i1',  'sneha', -21, -19], ['i5',  'divya',   -24, -20],
    ['i6',  'imran',   -18, -16], ['i7',  'rohan', -16, -13], ['i9',  'karthik', -14, -12],
    ['i3',  'meera',   -11, -10], ['i4',  'isha',   -9,  -4], ['i11', 'ananya',   -7,  -5],
    ['i13', 'dev',      -5,  -3]
  ].forEach(([item, who, from, until]) => seedRequest(ctx, item, E(who), from, until, 'Returned'));
  seedRequest(ctx, 'i6', E('dev'), -8, -6, 'Returned', { returnOff: -5 });          // one late return
  seedRequest(ctx, 'i8', E('aarav'), -2, 3, 'Borrowed', { note: 'Mine is at the service centre.' });

  setItems(ctx.items);
  setRequests(ctx.requests);
  setHistory(ctx.history);
  setReports([
    { id: 'rp1', itemId: 'i3', reporterId: E('dev'),   reason: 'Photo does not match the item', createdAt: addDays(-2), status: 'Open' },
    { id: 'rp2', itemId: 'i6', reporterId: E('rohan'), reason: 'Description is misleading',     createdAt: addDays(-1), status: 'Open' }
  ]);
  drop(KEY.userSeeds);
}

/* Gives a freshly created account some activity so every screen has content. */
function ensureUserSeed(email) {
  const done = load(KEY.userSeeds, []);
  if (done.includes(email)) return;
  const h = shortHash(email);
  const ctx = { items: getItems(), requests: getRequests(), history: getHistory() };
  const mine = (id, name, category, condition, location, description, extra = {}) => ({
    id: `${h}_${id}`, ownerId: email, name, category, description, condition, photo: null, location,
    availability: 'Available', availableFrom: addDays(-10), availableUntil: addDays(50), createdAt: addDays(-12), ...extra
  });
  ctx.items.push(
    mine('calc', 'Scientific Calculator', 'Calculators', 'Good', 'Block 3',
         'Casio fx-82MS with a hard cover. Works in all internal exams. Fresh battery fitted last month.'),
    mine('coat', 'Lab Coat', 'Lab Equipment', 'Good', 'Block 3',
         'Full-sleeve white lab coat, size L. Washed and folded. Suitable for chemistry and physics practicals.',
         { art: 'coat', availability: 'Borrowed' }),
    mine('dbms', 'DBMS Textbook', 'Books', 'Good', 'Library',
         'Database System Concepts, 6th edition. Neat pages with a few pencil notes in the SQL chapters.')
  );
  const calc = `${h}_calc`, coat = `${h}_coat`, dbms = `${h}_dbms`;
  const rq = (...args) => seedRequest(ctx, ...args);
  // requests for my items
  rq(calc, E('meera'), 1, 3, 'Pending', { note: 'I have the DBMS lab internal on Thursday and my calculator stopped working.' });
  rq(dbms, E('aarav'), 2, 9, 'Pending', { note: 'Need it for revision before the unit test.' });
  rq(coat, E('divya'), -2, 2, 'Borrowed', { note: 'Chemistry practical this week.' });
  // things I am borrowing
  rq('i2',  email, -2, 1, 'Borrowed', { note: 'For the statistics test.' });
  rq('i10', email, -6, -1, 'Borrowed', { note: 'Drawing sheet submission.' });
  rq('i12', email, 1, 6, 'Accepted', { note: 'Mini project on sensors.' });
  rq('i7',  email, 2, 3, 'Pending', { note: 'Long train journey on Friday.' });
  // history
  rq('i9', email, -14, -12, 'Returned');
  rq(calc, E('imran'), -10, -8, 'Returned');
  rq(dbms, E('sneha'), -22, -17, 'Returned');
  rq('i8', email, -16, -15, 'Declined', { note: 'My laptop charger stopped working.' });
  setItems(ctx.items); setRequests(ctx.requests); setHistory(ctx.history);
  done.push(email);
  save(KEY.userSeeds, done);
}

/* Clears listings and activity, keeps real accounts, and seeds again. */
function resetSampleData() {
  const real = Object.fromEntries(Object.entries(getUsers()).filter(([, u]) => u.password));
  [KEY.items, KEY.requests, KEY.history, KEY.reports, KEY.userSeeds, KEY.seeded].forEach(drop);
  save(KEY.users, real);
  seedCommunity();
  save(KEY.seeded, SEED_VERSION);
}

/* ---------- actions (each one maps to a future API route) ---------- */
function createItem(data) {
  const items = getItems();
  items.unshift({ id: uid('it'), createdAt: today(), photo: null, availability: 'Available', ...data });
  return setItems(items);
}

function setAvailability(id, value) {
  const items = getItems();
  const it = items.find(i => i.id === id);
  if (!it) return false;
  it.availability = value;
  return setItems(items);
}

function removeItem(id) {
  const reqs = getRequests();
  reqs.forEach(r => { if (r.itemId === id && r.status === 'Pending') { r.status = 'Declined'; r.respondedAt = today(); } });
  setRequests(reqs);
  return setItems(getItems().filter(i => i.id !== id));
}

function createRequest({ itemId, borrowerId, from, until, note }) {
  const it = getItem(itemId);
  if (!it) return null;
  const req = {
    id: uid('r'), itemId, borrowerId, ownerId: it.ownerId, requestDate: today(),
    borrowFrom: from, borrowUntil: until, note, status: 'Pending', createdAt: today()
  };
  const all = getRequests();
  all.unshift(req);
  setRequests(all);
  return req;
}

function respondToRequest(id, accept) {
  const all = getRequests();
  const req = all.find(r => r.id === id);
  if (!req || req.status !== 'Pending') return false;
  if (accept) {
    const items = getItems();
    const it = items.find(i => i.id === req.itemId);
    if (!it || it.availability !== 'Available') return false;
    it.availability = 'Reserved';
    req.status = 'Accepted';
    setItems(items);
  } else {
    req.status = 'Declined';
  }
  req.respondedAt = today();
  setRequests(all);
  return true;
}

function confirmCollected(id) {
  const all = getRequests();
  const req = all.find(r => r.id === id);
  if (!req || req.status !== 'Accepted') return false;
  req.status = 'Borrowed';
  const items = getItems();
  const it = items.find(i => i.id === req.itemId);
  if (it) it.availability = 'Borrowed';
  setItems(items);
  return setRequests(all);
}

/* Returns true when the item came back after its due date. */
function markReturned(id) {
  const all = getRequests();
  const req = all.find(r => r.id === id);
  if (!req || (req.status !== 'Borrowed')) return false;
  const late = today() > req.borrowUntil;
  req.status = 'Returned';
  req.returnedAt = today();
  const items = getItems();
  const it = items.find(i => i.id === req.itemId);
  if (it) it.availability = 'Available';
  setItems(items);
  setRequests(all);
  const hist = getHistory();
  hist.unshift({
    id: uid('h'), itemId: req.itemId, borrowerId: req.borrowerId, ownerId: req.ownerId,
    borrowDate: req.borrowFrom, dueDate: req.borrowUntil, returnDate: today(),
    status: late ? 'Returned late' : 'Returned'
  });
  setHistory(hist);
  return late;
}

function cancelRequest(id) {
  return setRequests(getRequests().filter(r => !(r.id === id && r.status === 'Pending')));
}

function reportItem(itemId, reporterId, reason) {
  const reports = getReports();
  if (reports.some(r => r.itemId === itemId && r.reporterId === reporterId && r.status === 'Open')) return false;
  reports.unshift({ id: uid('rp'), itemId, reporterId, reason, createdAt: today(), status: 'Open' });
  return setReports(reports);
}

function updateProfile(email, { name, dept }) {
  const users = getUsers();
  const u = users[email];
  if (!u) return false;
  u.name = name;
  u.dept = dept;
  setUsers(users);
  const s = getSession();
  if (s && s.email === email) setSession(u);   // keep the session name in step
  return true;
}

/* Returns 'ok' or 'wrong' (current password did not match). */
function changePassword(email, current, next) {
  const users = getUsers();
  const u = users[email];
  if (!u || u.password !== current) return 'wrong';
  u.password = next;
  setUsers(users);
  return 'ok';
}
