/* BorrowBox · admin
   Overview · Listings · Reported · Users · Borrowings
   The admin login is a client-side placeholder for phase 1.
   In phase 2 it becomes a real role check on the Express server. */

initData();

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

const A = { tab: 'overview', pendingRemove: null, borrowFilter: 'All' };
const dash = $('#dash'), gate = $('#gate');

function isAdmin() { try { return sessionStorage.getItem('bb_admin') === '1'; } catch (e) { return false; } }
function setAdmin(on) { try { on ? sessionStorage.setItem('bb_admin', '1') : sessionStorage.removeItem('bb_admin'); } catch (e) { /* ignore */ } }

function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 2400);
}

const itemName = id => { const it = getItem(id); return it ? esc(it.name) : 'Removed listing'; };
const statusChip = s => `<span class="chip st-${s.toLowerCase()}">${s}</span>`;
const AVAIL_LABEL = { Available: 'Available', Reserved: 'Reserved', Borrowed: 'Currently borrowed', Paused: 'Paused' };
const AVAIL_CLASS = { Available: 'st-available', Reserved: 'st-reserved', Borrowed: 'st-returned', Paused: 'st-muted' };

/* ---------- numbers ---------- */
function stats() {
  const reqs = getRequests();
  return {
    users: Object.keys(getUsers()).length,
    items: getItems().length,
    active: reqs.filter(r => r.status === 'Borrowed').length,
    completed: getHistory().length,
    overdue: reqs.filter(r => effectiveStatus(r) === 'Overdue').length,
    openReports: getReports().filter(r => r.status === 'Open' && getItem(r.itemId)).length,
    pending: reqs.filter(r => r.status === 'Pending').length
  };
}

/* Borrowings that started in each of the last six 7-day windows. */
function weeklyBorrowings() {
  const reqs = getRequests().filter(r => r.status === 'Borrowed' || r.status === 'Returned');
  const out = [];
  for (let w = 5; w >= 0; w--) {
    const end = addDays(-7 * w), start = addDays(-6, end);
    out.push({ label: fmtDate(start), value: reqs.filter(r => r.borrowFrom >= start && r.borrowFrom <= end).length, now: w === 0 });
  }
  return out;
}

/* ---------- tabs ---------- */
function overview() {
  const s = stats();
  const weeks = weeklyBorrowings();
  const maxW = Math.max(1, ...weeks.map(w => w.value));
  const byCat = CATEGORIES.map(c => ({ name: c.name, n: getItems().filter(i => i.category === c.name).length })).filter(c => c.n);
  const maxC = Math.max(1, ...byCat.map(c => c.n));
  return `
    <div class="two-col">
      <section class="panel">
        <h3>Borrowings started per week</h3>
        <p class="cap">Last six weeks, each bar is a 7-day window ending today.</p>
        <div class="bars" role="img" aria-label="Borrowings per week: ${weeks.map(w => `${w.label} ${w.value}`).join(', ')}">
          ${weeks.map(w => `<div class="bar-col ${w.now ? 'now' : ''}"><span>${w.value}</span><div class="bar" style="height:${Math.round(w.value / maxW * 130)}px"></div></div>`).join('')}
        </div>
        <div class="bar-labels">${weeks.map(w => `<span>${w.label}</span>`).join('')}</div>
      </section>
      <section class="panel">
        <h3>Needs attention</h3>
        <p class="cap">Open work for the admin.</p>
        <div class="attention">
          <a href="#" data-action="tab" data-id="reported"><span>Reported listings</span><b>${s.openReports}</b></a>
          <a href="#" data-action="overdue"><span>Overdue borrowings</span><b>${s.overdue}</b></a>
          <a href="#" data-action="tab" data-id="borrowings"><span>Requests waiting for owners</span><b>${s.pending}</b></a>
        </div>
      </section>
    </div>
    <section class="panel" style="margin-top:20px">
      <h3>Listings by category</h3>
      <p class="cap">${plural(s.items, 'item')} listed in total.</p>
      ${byCat.map(c => `<div class="hbar"><span>${esc(c.name)}</span><i style="--w:${Math.round(c.n / maxC * 100)}%"></i><em>${c.n}</em></div>`).join('')}
    </section>`;
}

function listings() {
  const items = [...getItems()].sort((x, y) => y.createdAt.localeCompare(x.createdAt));
  return `<div class="table-wrap"><table>
    <thead><tr><th scope="col">Item</th><th scope="col">Owner</th><th scope="col">Category</th><th scope="col">Status</th><th scope="col">Listed</th><th scope="col"><span class="sr-only">Action</span></th></tr></thead>
    <tbody>${items.map(it => {
      const confirming = A.pendingRemove === it.id;
      return `<tr><td><b>${esc(it.name)}</b><small>${esc(it.location)} · ${esc(it.condition)}</small></td>
        <td>${esc(displayName(it.ownerId))}</td><td>${esc(it.category)}</td>
        <td><span class="chip ${AVAIL_CLASS[it.availability] || 'st-muted'}">${AVAIL_LABEL[it.availability] || it.availability}</span></td>
        <td>${fmtDate(it.createdAt)}</td>
        <td><div class="btn-cell"><button class="button ${confirming ? 'button-danger' : 'button-outline'} small" type="button" data-action="remove" data-id="${esc(it.id)}">${confirming ? 'Click again to remove' : 'Remove'}</button></div></td></tr>`;
    }).join('')}</tbody></table></div>`;
}

function reported() {
  const open = getReports().filter(r => r.status === 'Open' && getItem(r.itemId));
  if (!open.length) return `<div class="empty"><h3>No open reports</h3><p>Reports from students show up here for review.</p></div>`;
  return open.map(r => {
    const it = getItem(r.itemId);
    return `<article class="report-card">
      <div><h3>${esc(it.name)}</h3>
        <p>${esc(r.reason)} · reported by ${esc(displayName(r.reporterId))} on ${fmtDate(r.createdAt)}</p>
        <p>Listed by ${esc(displayName(it.ownerId))}</p></div>
      <div class="btn-cell"><button class="button button-outline small" type="button" data-action="dismiss" data-id="${esc(r.id)}">Dismiss report</button>
        <button class="button button-danger small" type="button" data-action="remove-reported" data-id="${esc(r.id)}">Remove listing</button></div></article>`;
  }).join('');
}

function users() {
  const items = getItems(), reqs = getRequests();
  const list = Object.values(getUsers()).sort((x, y) => x.name.localeCompare(y.name));
  return `<div class="table-wrap"><table>
    <thead><tr><th scope="col">Student</th><th scope="col">Programme</th><th scope="col">Joined</th><th scope="col">Items listed</th><th scope="col">Borrowings</th><th scope="col">Status</th><th scope="col"><span class="sr-only">Action</span></th></tr></thead>
    <tbody>${list.map(u => `<tr><td><b>${esc(u.name)}</b><small>${esc(u.email)}</small></td><td>${esc(u.dept || 'Student')}</td><td>${fmtDate(u.joined)}</td>
      <td>${items.filter(i => i.ownerId === u.email).length}</td>
      <td>${reqs.filter(r => r.borrowerId === u.email && (r.status === 'Borrowed' || r.status === 'Returned')).length}</td>
      <td>${u.suspended ? '<span class="chip st-overdue">Suspended</span>' : '<span class="chip st-available">Active</span>'}</td>
      <td><div class="btn-cell"><button class="button button-outline small" type="button" data-action="suspend" data-id="${esc(u.email)}">${u.suspended ? 'Restore' : 'Suspend'}</button></div></td></tr>`).join('')}</tbody></table></div>`;
}

function borrowings() {
  const filters = ['All', 'Pending', 'Accepted', 'Borrowed', 'Overdue', 'Returned', 'Declined'];
  const list = getRequests().map(r => ({ ...r, eff: effectiveStatus(r) }))
    .filter(r => A.borrowFilter === 'All' || r.eff === A.borrowFilter)
    .sort((x, y) => y.createdAt.localeCompare(x.createdAt));
  return `<div class="filter-row" role="group" aria-label="Filter by status">${filters.map(f =>
      `<button class="pill ${A.borrowFilter === f ? 'active' : ''}" type="button" data-action="bfilter" data-id="${f}">${f}</button>`).join('')}</div>
    ${list.length ? `<div class="table-wrap"><table>
    <thead><tr><th scope="col">Item</th><th scope="col">Borrower</th><th scope="col">Owner</th><th scope="col">Dates</th><th scope="col">Status</th></tr></thead>
    <tbody>${list.map(r => `<tr><td>${itemName(r.itemId)}</td><td>${esc(displayName(r.borrowerId))}</td><td>${esc(displayName(r.ownerId))}</td>
      <td>${fmtDate(r.borrowFrom)} to ${fmtDate(r.borrowUntil)}</td><td>${statusChip(r.eff)}</td></tr>`).join('')}</tbody></table></div>`
    : `<div class="empty"><h3>No ${A.borrowFilter.toLowerCase()} borrowings</h3></div>`}`;
}

const TABS = [['overview', 'Overview'], ['listings', 'Listings'], ['reported', 'Reported'], ['users', 'Users'], ['borrowings', 'Borrowings']];

function renderDash() {
  const s = stats();
  const body = { overview, listings, reported, users, borrowings }[A.tab]();
  dash.innerHTML = `
    <div class="page-head"><div>
      <div class="eyebrow">BorrowBox · Admin</div>
      <h1 class="page-title">Campus <em>activity.</em></h1>
    </div></div>
    <div class="stats-4">
      <div class="stat"><b>${s.users}</b><span>Total users</span></div>
      <div class="stat"><b>${s.items}</b><span>Items listed</span></div>
      <div class="stat"><b>${s.active}</b><span>Active borrowings</span></div>
      <div class="stat"><b>${s.completed}</b><span>Completed borrowings</span></div>
    </div>
    <div class="admin-tabs" role="tablist">${TABS.map(([id, label]) =>
      `<button class="admin-tab ${A.tab === id ? 'active' : ''}" type="button" role="tab" aria-selected="${A.tab === id}" data-action="tab" data-id="${id}">${label}${id === 'reported' && s.openReports ? ` <i class="count-badge">${s.openReports}</i>` : ''}</button>`).join('')}</div>
    ${body}`;
}

function show() {
  const on = isAdmin();
  gate.hidden = on;
  dash.hidden = !on;
  $('#logoutBtn').hidden = !on;
  if (on) renderDash();
}

/* ---------- events ---------- */
const actions = {
  tab(id) { A.tab = id; A.pendingRemove = null; renderDash(); },
  overdue() { A.tab = 'borrowings'; A.borrowFilter = 'Overdue'; renderDash(); },
  bfilter(id) { A.borrowFilter = id; renderDash(); },
  remove(id) {
    if (A.pendingRemove === id) {
      removeItem(id);
      A.pendingRemove = null;
      toast('Listing removed.');
    } else {
      A.pendingRemove = id;
      setTimeout(() => { if (A.pendingRemove === id) { A.pendingRemove = null; if (A.tab === 'listings') renderDash(); } }, 5000);
    }
    renderDash();
  },
  dismiss(id) {
    const reports = getReports();
    const r = reports.find(x => x.id === id);
    if (r) r.status = 'Dismissed';
    setReports(reports);
    toast('Report dismissed.');
    renderDash();
  },
  'remove-reported'(id) {
    const reports = getReports();
    const r = reports.find(x => x.id === id);
    if (!r) return;
    removeItem(r.itemId);
    reports.forEach(x => { if (x.itemId === r.itemId) x.status = 'Removed'; });
    setReports(reports);
    toast('Listing removed and report closed.');
    renderDash();
  },
  suspend(email) {
    const all = getUsers();
    if (!all[email]) return;
    all[email].suspended = !all[email].suspended;
    setUsers(all);
    toast(all[email].suspended ? 'Account suspended.' : 'Account restored.');
    renderDash();
  }
};

document.addEventListener('click', e => {
  const btn = e.target.closest('[data-action]');
  if (!btn || !actions[btn.dataset.action]) return;
  e.preventDefault();
  actions[btn.dataset.action](btn.dataset.id);
});

$('#adminForm').addEventListener('submit', e => {
  e.preventDefault();
  const data = new FormData(e.currentTarget);
  const ok = String(data.get('email')).trim().toLowerCase() === ADMIN_LOGIN.email && data.get('password') === ADMIN_LOGIN.password;
  if (!ok) { $('#adminError').textContent = 'The admin email or password is incorrect.'; return; }
  setAdmin(true);
  e.currentTarget.reset();
  $('#adminError').textContent = '';
  show();
});
$('#logoutBtn').addEventListener('click', () => { setAdmin(false); A.tab = 'overview'; show(); });

show();
