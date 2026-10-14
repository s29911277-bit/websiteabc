/* BorrowBox · student app
   One page (app.html) that swaps screens by URL hash:
   #/dashboard  #/browse  #/item/ID  #/list  #/request/ID
   #/requests   #/borrowings  #/my-items  #/history           */

initData();
const session = getSession();
const me = session && userOf(session.email);
const authed = !!me && !me.suspended;
if (!authed) {
  clearSession();
  location.replace('index.html');
} else {
  ensureUserSeed(me.email);
}

/* ---------- tiny helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const initial = name => (name || '?').trim().charAt(0).toUpperCase();
const firstName = email => displayName(email).split(' ')[0];
const view = $('#view');

/* Filters and tab choices that should survive re-rendering */
const ui = { cat: 'All', q: '', avail: 'all', loc: 'All', cond: 'All', bf: 'All', ht: 'borrowed', photo: null, pendingRemove: null };

const AVAIL = {
  Available: ['Available', 'st-available'],
  Reserved: ['Reserved', 'st-reserved'],
  Borrowed: ['Currently borrowed', 'st-returned'],
  Paused: ['Paused', 'st-muted']
};
const availChip = it => { const [label, cls] = AVAIL[it.availability] || AVAIL.Available; return `<span class="chip ${cls}">${label}</span>`; };
const statusChip = s => `<span class="chip st-${s.toLowerCase()}">${s}</span>`;

function itemMedia(it) {
  const cat = catOf(it.category);
  const inner = it.photo ? `<img src="${esc(it.photo)}" alt="">` : artSvg(it.art || cat.art);
  return `<div class="media tone-${cat.tone}">${inner}</div>`;
}

function itemCard(it) {
  return `<article class="item-card">
    <a class="media-link" href="#/item/${esc(it.id)}" tabindex="-1" aria-hidden="true">${itemMedia(it)}<span class="badge-pos">${availChip(it)}</span></a>
    <div class="item-body">
      <div class="item-cat">${esc(it.category)}</div>
      <h3><a href="#/item/${esc(it.id)}">${esc(it.name)}</a></h3>
      <div class="item-facts"><span>${esc(it.condition)}</span><span>${esc(it.location)}</span></div>
      <div class="spacer"></div>
      <a class="button button-outline small" href="#/item/${esc(it.id)}">View details</a>
    </div>
  </article>`;
}

function dueText(r) {
  const d = daysBetween(today(), r.borrowUntil);
  if (d < 0) return { text: `${plural(-d, 'day')} overdue`, late: true };
  if (d === 0) return { text: 'Due today', late: false };
  if (d === 1) return { text: 'Due tomorrow', late: false };
  return { text: `${d} days left`, late: false };
}
function ago(date) {
  const d = daysBetween(date, today());
  return d <= 0 ? 'Today' : d === 1 ? 'Yesterday' : `${d} days ago`;
}

function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 2600);
}

function page(title, html) {
  document.title = `${title} · BorrowBox`;
  view.innerHTML = html;
}
function notFound(message) {
  page('Not found', `<div class="empty"><h3>Nothing here</h3><p>${esc(message)}</p><a class="button button-dark" href="#/browse">Browse items</a></div>`);
}

function activity() {
  const reqs = getRequests();
  const borrowing = reqs.filter(r => r.borrowerId === me.email && r.status === 'Borrowed');
  return {
    borrowing,
    overdue: borrowing.filter(r => r.borrowUntil < today()),
    incoming: reqs.filter(r => r.ownerId === me.email && r.status === 'Pending'),
    outgoing: reqs.filter(r => r.borrowerId === me.email && r.status === 'Pending'),
    myItems: getItems().filter(i => i.ownerId === me.email),
    avoided: reqs.filter(r => r.borrowerId === me.email && (r.status === 'Borrowed' || r.status === 'Returned')).length
  };
}

/* =====================================================================
   Screen 2 · Dashboard
   ===================================================================== */
const QUICK = [['Books', '📚', 'Books'], ['Calculators', '🧮', 'Calculators'], ['Electronics', '🔌', 'Electronics'],
               ['Lab', '🥼', 'Lab Equipment'], ['Sports', '🏸', 'Sports Equipment'], ['Supplies', '🎨', 'Art Supplies']];

function renderDashboard() {
  const a = activity();
  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const items = getItems().filter(i => i.ownerId !== me.email && i.availability === 'Available');
  const preferred = ['i1', 'i4', 'i5', 'i6'].map(id => items.find(i => i.id === id)).filter(Boolean);
  const near = [...preferred, ...items.filter(i => !preferred.includes(i))].slice(0, 4);

  const upcoming = a.borrowing.filter(r => r.borrowUntil >= today()).sort((x, y) => x.borrowUntil.localeCompare(y.borrowUntil))[0];
  const borrowSub = a.overdue.length ? `${a.overdue.length} overdue` : upcoming ? `Next due ${fmtDate(upcoming.borrowUntil)}` : 'Nothing borrowed right now';
  const lentOut = a.myItems.filter(i => i.availability === 'Borrowed' || i.availability === 'Reserved').length;
  const listed = a.myItems.filter(i => i.availability === 'Available').length;

  const notice = a.overdue.length ? (() => {
    const r = a.overdue[0], it = getItem(r.itemId);
    return `<div class="notice" role="alert"><span><b>${esc(it ? it.name : 'An item')}</b> is ${plural(daysBetween(r.borrowUntil, today()), 'day')} overdue. Return it to ${esc(firstName(r.ownerId))} as soon as you can.</span>
      <a class="button button-dark small" href="#/borrowings">Go to My Borrowings</a></div>`;
  })() : '';

  page('Dashboard', `
    ${notice}
    <section class="dash-hero">
      <div>
        <div class="eyebrow"><span class="live-dot"></span>${hello}, ${esc(me.name.split(' ')[0])}</div>
        <h1>Share more.<br><em>Buy less.</em></h1>
        <form class="big-search" id="dashSearch" role="search">
          <label class="sr-only" for="dashQ">What do you need?</label>
          <input id="dashQ" type="search" placeholder="What do you need?" autocomplete="off">
          <button class="button button-dark" type="submit">Search</button>
        </form>
        <div class="quick-cats">${QUICK.map(([label, emoji, cat]) => `<button class="pill" type="button" data-action="go-cat" data-id="${esc(cat)}">${emoji} ${label}</button>`).join('')}</div>
      </div>
      <aside class="panel" aria-labelledby="actTitle">
        <h2 class="panel-title" id="actTitle">My activity</h2>
        <a class="act-row" href="#/borrowings"><span class="act-num">${a.borrowing.length}</span><span><b>Current borrowings</b><small>${esc(borrowSub)}</small></span><span class="arrow">→</span></a>
        <a class="act-row" href="${a.incoming.length ? '#/requests' : '#/borrowings'}"><span class="act-num">${a.incoming.length + a.outgoing.length}</span><span><b>Pending requests</b><small>${a.incoming.length} waiting for your reply · ${a.outgoing.length} sent by you</small></span><span class="arrow">→</span></a>
        <a class="act-row" href="#/my-items"><span class="act-num">${a.myItems.length}</span><span><b>My listed items</b><small>${listed} available · ${lentOut} lent out</small></span><span class="arrow">→</span></a>
        <p class="impact"><b>${a.avoided}</b> ${a.avoided === 1 ? 'purchase' : 'purchases'} avoided by borrowing</p>
      </aside>
    </section>

    <div class="section-head"><h2>Available near you</h2><a href="#/browse">Browse everything →</a></div>
    <div class="item-grid">${near.map(itemCard).join('')}</div>`);
}

/* =====================================================================
   Screen 3 · Browse items (search + filters)
   ===================================================================== */
function renderBrowse() {
  const locs = [...new Set(getItems().map(i => i.location))].sort();
  const chips = [`<button class="pill ${ui.cat === 'All' ? 'active' : ''}" type="button" data-action="filter-cat" data-id="All">All items</button>`]
    .concat(CATEGORIES.map(c => `<button class="pill ${ui.cat === c.name ? 'active' : ''}" type="button" data-action="filter-cat" data-id="${esc(c.name)}">${c.emoji} ${esc(c.name)}</button>`)).join('');

  page('Browse items', `
    <div class="page-head"><div>
      <div class="eyebrow">Browse items</div>
      <h1 class="page-title">What can you <em>borrow</em> today?</h1>
    </div></div>
    <div class="filters">
      <label class="search-field"><span class="sr-only">Search items</span>
        <input id="q" type="search" placeholder="Search calculator, lab coat, umbrella…" value="${esc(ui.q)}" autocomplete="off"></label>
      <label class="select-field">Availability<select id="fAvail"><option value="all">All items</option><option value="now">Available now</option></select></label>
      <label class="select-field">Location<select id="fLoc"><option value="All">Anywhere</option>${locs.map(l => `<option>${esc(l)}</option>`).join('')}</select></label>
      <label class="select-field">Condition<select id="fCond"><option value="All">Any condition</option>${CONDITIONS.map(c => `<option>${c}</option>`).join('')}</select></label>
    </div>
    <div class="cat-row" id="catRow" aria-label="Filter by category">${chips}</div>
    <div class="results-head"><span id="resultCount" aria-live="polite"></span><button class="link-btn" type="button" data-action="clear-filters">Clear filters</button></div>
    <div class="item-grid" id="results"></div>
    <div class="empty" id="noResults" hidden>
      <h3>No items match that</h3>
      <p>Try another word or category. If nobody has it yet, you could be the first to list one.</p>
      <button class="button button-dark" type="button" data-action="clear-filters">Clear filters</button>
    </div>`);
  $('#fAvail').value = ui.avail;
  $('#fLoc').value = ui.loc;
  $('#fCond').value = ui.cond;
  updateResults();
}

function updateResults() {
  const words = ui.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const rank = { Available: 0, Reserved: 1, Borrowed: 2 };
  const list = getItems().filter(it => {
    if (it.ownerId === me.email || it.availability === 'Paused') return false;
    if (ui.cat !== 'All' && it.category !== ui.cat) return false;
    if (ui.avail === 'now' && it.availability !== 'Available') return false;
    if (ui.loc !== 'All' && it.location !== ui.loc) return false;
    if (ui.cond !== 'All' && it.condition !== ui.cond) return false;
    const hay = `${it.name} ${it.category} ${it.description} ${it.location}`.toLowerCase();
    return words.every(w => hay.includes(w));
  }).sort((x, y) => (rank[x.availability] - rank[y.availability]) || y.createdAt.localeCompare(x.createdAt));

  $('#results').innerHTML = list.map(itemCard).join('');
  $('#noResults').hidden = list.length > 0;
  const q = ui.q.trim();
  $('#resultCount').textContent = `${plural(list.length, 'item')}${q ? ` for “${q}”` : ''}`;
}

/* =====================================================================
   Screen 4 · Item details
   ===================================================================== */
const REPORT_REASONS = ['Photo does not match the item', 'Description is misleading', 'Inappropriate listing', 'Item looks unsafe', 'Something else'];

function renderItem(id) {
  const it = getItem(id);
  if (!it) return notFound('That item is no longer listed.');
  const owner = userOf(it.ownerId) || { name: 'Former member', dept: '', joined: today() };
  const own = it.ownerId === me.email;
  const active = activeRequestFor(id);
  const mineReq = getRequests().find(r => r.itemId === id && r.borrowerId === me.email && ['Pending', 'Accepted', 'Borrowed'].includes(r.status));
  const lent = getHistory().filter(h => h.ownerId === it.ownerId).length;

  let cta;
  if (own) cta = `<a class="button button-outline" href="#/my-items">Manage in My Items</a><span class="cta-note">This is your listing.</span>`;
  else if (mineReq) cta = `<a class="button button-outline" href="#/borrowings">View your request</a><span class="cta-note">You already have a ${esc(mineReq.status.toLowerCase())} request for this item.</span>`;
  else if (it.availability === 'Available') cta = `<a class="button button-dark" href="#/request/${esc(it.id)}">Request to borrow <span>↗</span></a>`;
  else if (it.availability === 'Paused') cta = `<button class="button button-dark" type="button" disabled>Request to borrow</button><span class="cta-note">The owner has paused this listing.</span>`;
  else if (it.availability === 'Reserved') cta = `<button class="button button-dark" type="button" disabled>Request to borrow</button><span class="cta-note">Reserved for another student.</span>`;
  else cta = `<button class="button button-dark" type="button" disabled>Request to borrow</button><span class="cta-note">Currently borrowed${active ? `, due back ${fmtDate(active.borrowUntil)}` : ''}.</span>`;

  const report = own ? '' : `<details class="report"><summary>Report this listing</summary>
      <form id="reportForm" data-item="${esc(it.id)}"><select id="reportReason" aria-label="Reason">${REPORT_REASONS.map(r => `<option>${esc(r)}</option>`).join('')}</select>
      <button class="button button-outline small" type="submit">Send report</button></form></details>`;

  page(it.name, `
    <p class="crumbs"><a href="#/browse">← Browse items</a></p>
    <div class="detail">
      <div>${itemMedia(it)}</div>
      <div>
        <div class="eyebrow">${catOf(it.category).emoji} ${esc(it.category)}</div>
        <h1>${esc(it.name)}</h1>
        <div class="detail-chips">${availChip(it)}<span class="chip st-muted">${esc(it.condition)} condition</span></div>
        <p class="detail-desc">${esc(it.description)}</p>
        <dl class="facts">
          <dt>Category</dt><dd>${esc(it.category)}</dd>
          <dt>Condition</dt><dd>${esc(it.condition)}</dd>
          <dt>Pickup location</dt><dd>${esc(it.location)}</dd>
          <dt>Available dates</dt><dd>${fmtDate(it.availableFrom)} to ${fmtDate(it.availableUntil)}</dd>
          <dt>Available now</dt><dd>${it.availability === 'Available' ? 'Yes' : 'No'}</dd>
        </dl>
        <div class="owner-card">
          <span class="avatar" aria-hidden="true">${esc(initial(owner.name))}</span>
          <span><b>${esc(owner.name)}</b><small>${esc(owner.dept || 'Student')} · ${plural(lent, 'item')} lent so far</small></span>
        </div>
        <div class="cta-row">${cta}</div>
        ${report}
      </div>
    </div>`);
}

/* =====================================================================
   Screen 5 · List an item
   ===================================================================== */
function renderList() {
  ui.photo = null;
  page('List an item', `
    <div class="page-head"><div>
      <div class="eyebrow">List an item</div>
      <h1 class="page-title">Lend something <em>you own.</em></h1>
      <p class="page-sub">Add what it is, where students can pick it up and when it is free to borrow.</p>
    </div></div>
    <div class="form-layout">
      <form class="form-card" id="listForm" novalidate>
        <label class="field">Item name
          <input id="itName" name="name" required maxlength="60" placeholder="e.g. Casio scientific calculator"></label>
        <div class="form-row">
          <label class="field">Category<select id="itCat" name="category">${CATEGORIES.map(c => `<option>${esc(c.name)}</option>`).join('')}</select></label>
          <label class="field">Condition<select id="itCond" name="condition">${CONDITIONS.map(c => `<option ${c === 'Good' ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
        </div>
        <label class="field">Description
          <textarea id="itDesc" name="description" maxlength="300" rows="3" placeholder="What is included, anything to know before borrowing"></textarea></label>
        <label class="field">General pickup location
          <input id="itLoc" name="location" list="locList" required maxlength="40" placeholder="Block 3, Library, Main Gate…">
          <datalist id="locList">${LOCATIONS.map(l => `<option value="${esc(l)}">`).join('')}</datalist>
          <small>Pick a public spot on campus. Do not share room numbers.</small></label>
        <div class="form-row">
          <label class="field">Available from<input id="itFrom" name="from" type="date" required min="${today()}" value="${today()}"></label>
          <label class="field">Available until<input id="itUntil" name="until" type="date" required min="${today()}" value="${addDays(30)}"></label>
        </div>
        <div class="field">Photograph
          <label class="photo-drop">Choose a photo<small>JPG or PNG. Without one, an illustration is used.</small>
            <input id="itPhoto" type="file" accept="image/*"></label>
          <div class="photo-preview" id="photoPreview"></div>
        </div>
        <div class="form-error" id="listError" role="alert"></div>
        <div class="form-actions">
          <button class="button button-dark" type="submit">List item <span>↗</span></button>
          <a class="button button-outline" href="#/my-items">Cancel</a>
        </div>
      </form>
      <aside class="panel aside-card">
        <div class="eyebrow">Before you list</div>
        <h3>Keep it simple</h3>
        <ul class="tip-list">
          <li>Say honestly what condition it is in.</li>
          <li>Choose a pickup spot you pass anyway.</li>
          <li>You decide who borrows it. Every request needs your approval.</li>
        </ul>
      </aside>
    </div>`);
}

function readPhoto(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = reject;
    fr.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, 720 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.78));
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}


async function submitList(form) {
  console.log("SUBMIT LIST FUNCTION CALLED");
  console.log("Listing form data:", new FormData(form));
  const err = $('#listError');
  err.textContent = '';

  const name = $('#itName').value.trim();
  const location_ = $('#itLoc').value.trim();
  const from = $('#itFrom').value;
  const until = $('#itUntil').value;

  if (!name) {
    err.textContent = 'Give the item a name.';
    return;
  }

  if (!location_) {
    err.textContent = 'Add a general pickup location.';
    return;
  }

  if (!from || !until) {
    err.textContent = 'Choose when the item is available.';
    return;
  }

  if (until < from) {
    err.textContent = 'The available-until date cannot be before the start date.';
    return;
  }

  const item = {
    ownerId: me.email,
    name: name,
    category: $('#itCat').value,
    condition: $('#itCond').value,
    description: $('#itDesc').value.trim() || 'No extra details.',
    location: location_,
    availableFrom: from,
    availableUntil: until,
    availability: 'Available'
  };

  const saved = createItem({ ...item, photo: ui.photo });
  if (!saved) {
    err.textContent = 'Could not save the listing in this browser. Check available storage and try again.';
    return;
  }

  ui.photo = null;
  toast('Your item has been saved.');
  location.hash = '#/my-items';
}


/* =====================================================================
   Screen 6 · Borrow request (borrower form + owner inbox)
   ===================================================================== */
function renderRequestForm(id) {
  const it = getItem(id);
  if (!it || it.ownerId === me.email || it.availability !== 'Available') { location.hash = `#/item/${id}`; return; }
  const minFrom = maxDate(today(), it.availableFrom);
  const from = maxDate(minFrom, addDays(1));
  const fromVal = from <= it.availableUntil ? from : minFrom;
  const untilVal = minDate(addDays(2, fromVal), it.availableUntil);
  const untilMax = minDate(it.availableUntil, addDays(MAX_LOAN_DAYS - 1, fromVal));

  page('Request to borrow', `
    <p class="crumbs"><a href="#/item/${esc(it.id)}">← Back to ${esc(it.name)}</a></p>
    <div class="page-head"><div>
      <div class="eyebrow">Borrow request</div>
      <h1 class="page-title">Ask ${esc(firstName(it.ownerId))} to <em>lend it.</em></h1>
      <p class="page-sub">${esc(firstName(it.ownerId))} will get your request and can accept or decline. You can borrow for up to ${MAX_LOAN_DAYS} days.</p>
    </div></div>
    <div class="form-layout">
      <form class="form-card" id="requestForm" data-item="${esc(it.id)}" novalidate>
        <div class="form-row">
          <label class="field">Borrow from<input id="reqFrom" type="date" required min="${minFrom}" max="${it.availableUntil}" value="${fromVal}"></label>
          <label class="field">Return by<input id="reqUntil" type="date" required min="${fromVal}" max="${untilMax}" value="${untilVal}"></label>
        </div>
        <small class="cta-note" style="display:block;margin-top:8px">Available ${fmtDate(it.availableFrom)} to ${fmtDate(it.availableUntil)}.</small>
        <label class="field">Message to the owner
          <textarea id="reqNote" maxlength="200" rows="3" placeholder="What do you need it for? (optional)"></textarea></label>
        <label class="check"><input id="reqAgree" type="checkbox"><span>I will return it on time and in the same condition.</span></label>
        <div class="form-error" id="reqError" role="alert"></div>
        <div class="form-actions">
          <button class="button button-dark" type="submit">Send request <span>↗</span></button>
          <a class="button button-outline" href="#/item/${esc(it.id)}">Cancel</a>
        </div>
      </form>
      <aside class="panel aside-card">
        ${itemMedia(it)}
        <h3>${esc(it.name)}</h3>
        <p>${esc(it.condition)} · Pickup at ${esc(it.location)}</p>
        <p style="margin-top:6px">Lent by ${esc(displayName(it.ownerId))}</p>
      </aside>
    </div>`);
}

function submitRequest(form) {
  const it = getItem(form.dataset.item);
  const err = $('#reqError');
  err.textContent = '';
  if (!it || it.availability !== 'Available') { err.textContent = 'This item is no longer available.'; return; }
  const from = $('#reqFrom').value, until = $('#reqUntil').value;
  const minFrom = maxDate(today(), it.availableFrom);
  if (!from || !until) { err.textContent = 'Choose both dates.'; return; }
  if (from < minFrom) { err.textContent = `The earliest pickup is ${fmtDate(minFrom)}.`; return; }
  if (until < from) { err.textContent = 'The return date cannot be before the pickup date.'; return; }
  if (until > it.availableUntil) { err.textContent = `The owner has this item until ${fmtDate(it.availableUntil)}.`; return; }
  if (daysBetween(from, until) + 1 > MAX_LOAN_DAYS) { err.textContent = `You can borrow an item for up to ${MAX_LOAN_DAYS} days.`; return; }
  if (!$('#reqAgree').checked) { err.textContent = 'Please confirm you will return it on time and in the same condition.'; return; }
  createRequest({ itemId: it.id, borrowerId: me.email, from, until, note: $('#reqNote').value.trim() });
  ui.bf = 'All';
  toast(`Request sent to ${firstName(it.ownerId)}.`);
  location.hash = '#/borrowings';
}

function renderRequests() {
  const all = getRequests().filter(r => r.ownerId === me.email);
  const pending = all.filter(r => r.status === 'Pending');
  const earlier = all.filter(r => r.status !== 'Pending').sort((x, y) => y.createdAt.localeCompare(x.createdAt)).slice(0, 8);

  const card = r => {
    const it = getItem(r.itemId);
    const canAccept = it && it.availability === 'Available';
    return `<article class="req-card">
      <div class="req-head"><span class="eyebrow">New borrow request</span><span class="req-age">${ago(r.createdAt)}</span></div>
      <p class="req-line"><b>${esc(displayName(r.borrowerId))}</b> wants to borrow your <b>${esc(it ? it.name : 'item')}</b>.</p>
      <dl class="req-dates">
        <div><dt>Requested date</dt><dd>${fmtDate(r.borrowFrom)}</dd></div>
        <div><dt>Return date</dt><dd>${fmtDate(r.borrowUntil)}</dd></div>
        <div><dt>Duration</dt><dd>${plural(daysBetween(r.borrowFrom, r.borrowUntil) + 1, 'day')}</dd></div>
      </dl>
      ${r.note ? `<p class="req-note">“${esc(r.note)}”</p>` : ''}
      <div class="req-actions">
        <button class="button button-dark" type="button" data-action="accept" data-id="${esc(r.id)}" ${canAccept ? '' : 'disabled'}>Accept</button>
        <button class="button button-outline" type="button" data-action="decline" data-id="${esc(r.id)}">Decline</button>
        ${canAccept ? '' : '<span class="hint">This item is not free right now, so you can only decline.</span>'}
      </div></article>`;
  };

  page('Requests', `
    <div class="page-head"><div>
      <div class="eyebrow">Requests for your items</div>
      <h1 class="page-title">Who wants to <em>borrow</em> from you?</h1>
    </div></div>
    ${pending.length ? `<div class="req-list">${pending.map(card).join('')}</div>`
      : `<div class="empty"><h3>No requests waiting</h3><p>When someone asks to borrow one of your items, it shows up here.</p><a class="button button-dark" href="#/my-items">Go to My Items</a></div>`}
    ${earlier.length ? `<div class="section-head"><h2>Earlier</h2></div><div class="req-earlier">${earlier.map(r => {
      const it = getItem(r.itemId);
      return `<div class="line-row"><span>${esc(displayName(r.borrowerId))} · ${esc(it ? it.name : 'Removed listing')}<small>${fmtDate(r.borrowFrom)} to ${fmtDate(r.borrowUntil)}</small></span>${statusChip(effectiveStatus(r))}</div>`;
    }).join('')}</div>` : ''}`);
}

/* =====================================================================
   Screen 7 · My Borrowings
   ===================================================================== */
const BORROW_FILTERS = ['All', 'Pending', 'Accepted', 'Borrowed', 'Overdue', 'Returned', 'Declined'];

function renderBorrowings() {
  const rank = { Overdue: 0, Borrowed: 1, Accepted: 2, Pending: 3, Returned: 4, Declined: 5 };
  const mine = getRequests().filter(r => r.borrowerId === me.email).map(r => ({ ...r, eff: effectiveStatus(r) }))
    .sort((x, y) => (rank[x.eff] - rank[y.eff]) || y.borrowFrom.localeCompare(x.borrowFrom));
  const count = f => f === 'All' ? mine.length : mine.filter(r => r.eff === f).length;
  const shown = ui.bf === 'All' ? mine : mine.filter(r => r.eff === ui.bf);

  const row = r => {
    const it = getItem(r.itemId);
    const name = it ? it.name : 'Listing removed';
    const due = r.eff === 'Borrowed' || r.eff === 'Overdue' ? dueText(r) : null;
    let dates, actions = '';
    if (r.eff === 'Pending') {
      dates = `<div><dt>Wanted</dt><dd>${fmtDate(r.borrowFrom)} to ${fmtDate(r.borrowUntil)}</dd></div><div><dt>Sent</dt><dd>${fmtDate(r.requestDate)}</dd></div>`;
      actions = `<button class="button button-outline small" type="button" data-action="cancel" data-id="${esc(r.id)}">Cancel request</button>`;
    } else if (r.eff === 'Accepted') {
      dates = `<div><dt>Pickup</dt><dd>${fmtDate(r.borrowFrom)}${it ? ' at ' + esc(it.location) : ''}</dd></div><div><dt>Return by</dt><dd>${fmtDate(r.borrowUntil)}</dd></div>`;
      actions = `<button class="button button-dark small" type="button" data-action="collect" data-id="${esc(r.id)}">I have collected it</button>`;
    } else if (r.eff === 'Borrowed' || r.eff === 'Overdue') {
      dates = `<div><dt>Borrowed</dt><dd>${fmtDate(r.borrowFrom)}</dd></div><div><dt>Due</dt><dd>${fmtDate(r.borrowUntil)}</dd></div>`;
      actions = `<button class="button button-dark small" type="button" data-action="return" data-id="${esc(r.id)}">Mark as returned</button>`;
    } else if (r.eff === 'Returned') {
      dates = `<div><dt>Borrowed</dt><dd>${fmtDate(r.borrowFrom)}</dd></div><div><dt>Returned</dt><dd>${fmtDate(r.returnedAt)}</dd></div>`;
    } else {
      dates = `<div><dt>Requested</dt><dd>${fmtDate(r.requestDate)}</dd></div><div><dt>Answered</dt><dd>${fmtDate(r.respondedAt || r.requestDate)}</dd></div>`;
    }
    return `<article class="row-card ${r.eff === 'Overdue' ? 'is-overdue' : ''}">
      ${it ? itemMedia(it) : '<div class="media tone-sage"></div>'}
      <div class="row-main">
        <h3>${it ? `<a href="#/item/${esc(it.id)}">${esc(name)}</a>` : esc(name)}</h3>
        <p class="row-sub">From ${esc(displayName(r.ownerId))}</p>
        <dl class="row-dates">${dates}</dl>
      </div>
      <div class="row-side">
        ${statusChip(r.eff)}
        ${due ? `<span class="due-note ${due.late ? 'late' : ''}">${due.text}</span>` : ''}
        ${actions ? `<div class="row-actions">${actions}</div>` : ''}
      </div></article>`;
  };

  page('My Borrowings', `
    <div class="page-head"><div>
      <div class="eyebrow">My borrowings</div>
      <h1 class="page-title">Things you have <em>borrowed.</em></h1>
    </div><a class="button button-outline" href="#/browse">Find something else</a></div>
    <div class="filter-row" role="group" aria-label="Filter by status">${BORROW_FILTERS.map(f =>
      `<button class="pill ${ui.bf === f ? 'active' : ''}" type="button" data-action="bf" data-id="${f}">${f} <small>${count(f)}</small></button>`).join('')}</div>
    ${shown.length ? `<div class="row-list">${shown.map(row).join('')}</div>`
      : `<div class="empty"><h3>${ui.bf === 'All' ? 'Nothing borrowed yet' : `No ${ui.bf.toLowerCase()} items`}</h3><p>Search for something you need and send a request.</p><a class="button button-dark" href="#/browse">Browse items</a></div>`}`);
}

/* =====================================================================
   Screen 8 · My Items
   ===================================================================== */
function renderMyItems() {
  const reqs = getRequests();
  const mine = getItems().filter(i => i.ownerId === me.email);
  const waiting = reqs.filter(r => r.ownerId === me.email && r.status === 'Pending').length;
  const rank = { Borrowed: 0, Reserved: 1, Available: 2, Paused: 3 };
  mine.sort((x, y) => rank[x.availability] - rank[y.availability]);

  const row = it => {
    const active = reqs.find(r => r.itemId === it.id && (r.status === 'Accepted' || r.status === 'Borrowed'));
    const pend = reqs.filter(r => r.itemId === it.id && r.status === 'Pending').length;
    const confirming = ui.pendingRemove === it.id;
    let info = '', actions = '';
    if (it.availability === 'Borrowed' && active) {
      const d = dueText(active);
      info = `With ${esc(displayName(active.borrowerId))} · due ${fmtDate(active.borrowUntil)} <span class="due-note ${d.late ? 'late' : ''}">(${d.text})</span>`;
      actions = `<button class="button button-dark small" type="button" data-action="return" data-id="${esc(active.id)}">Mark as returned</button>`;
    } else if (it.availability === 'Reserved' && active) {
      info = `Reserved for ${esc(displayName(active.borrowerId))} · pickup ${fmtDate(active.borrowFrom)}`;
      actions = `<button class="button button-dark small" type="button" data-action="collect" data-id="${esc(active.id)}">Confirm handover</button>`;
    } else if (it.availability === 'Paused') {
      info = 'Hidden from Browse';
      actions = `<button class="button button-outline small" type="button" data-action="resume" data-id="${esc(it.id)}">Resume listing</button>`;
    } else {
      info = pend ? `<a href="#/requests"><b>${plural(pend, 'request')} waiting</b></a>` : 'Visible in Browse';
      actions = `<button class="button button-outline small" type="button" data-action="pause" data-id="${esc(it.id)}">Pause listing</button>`;
    }
    const removable = it.availability === 'Available' || it.availability === 'Paused';
    const removeBtn = removable
      ? `<button class="button ${confirming ? 'button-danger' : 'button-outline'} small" type="button" data-action="remove" data-id="${esc(it.id)}">${confirming ? 'Click again to remove' : 'Remove'}</button>` : '';
    return `<article class="row-card">
      ${itemMedia(it)}
      <div class="row-main">
        <h3><a href="#/item/${esc(it.id)}">${esc(it.name)}</a></h3>
        <p class="row-sub">${esc(it.category)} · ${esc(it.condition)} · ${esc(it.location)}</p>
        <p style="font-size:14px">${info}</p>
      </div>
      <div class="row-side">${availChip(it)}<div class="row-actions">${actions}${removeBtn}</div></div></article>`;
  };

  const n = s => mine.filter(i => i.availability === s).length;
  page('My Items', `
    <div class="page-head"><div>
      <div class="eyebrow">My items</div>
      <h1 class="page-title">What you are <em>sharing.</em></h1>
    </div><a class="button button-dark" href="#/list">＋ List an item</a></div>
    ${waiting ? `<div class="notice" style="background:#f3f8dd;border-color:#dbe8a6;color:#3d5210"><span><b>${plural(waiting, 'request')}</b> waiting for your reply.</span><a class="button button-dark small" href="#/requests">Review requests</a></div>` : ''}
    <div class="summary-strip"><span><b>${n('Available')}</b>available</span><span><b>${n('Reserved')}</b>reserved</span><span><b>${n('Borrowed')}</b>currently borrowed</span><span><b>${n('Paused')}</b>paused</span></div>
    ${mine.length ? `<div class="row-list">${mine.map(row).join('')}</div>`
      : `<div class="empty"><h3>You have not listed anything yet</h3><p>Got a calculator, a lab coat or an umbrella that sits unused? List it.</p><a class="button button-dark" href="#/list">List an item</a></div>`}`);
}

/* =====================================================================
   Screen 9 · Borrowing history
   ===================================================================== */
function renderHistory() {
  const hist = getHistory();
  const borrowed = hist.filter(h => h.borrowerId === me.email);
  const lent = hist.filter(h => h.ownerId === me.email);
  const onTime = borrowed.filter(h => h.status === 'Returned').length;
  const nameOf = id => { const it = getItem(id); return it ? esc(it.name) : 'Removed listing'; };
  const result = s => `<span class="chip ${s === 'Returned late' ? 'st-overdue' : 'st-returned'}">${s}</span>`;
  const sortBy = (a, b) => (b.returnDate || '').localeCompare(a.returnDate || '');

  let head, rows;
  if (ui.ht === 'borrowed') {
    head = ['Item', 'Lent by', 'Borrowed', 'Due', 'Returned', 'Result'];
    rows = [...borrowed].sort(sortBy).map(h => `<tr><td>${nameOf(h.itemId)}</td><td>${esc(displayName(h.ownerId))}</td><td>${fmtDate(h.borrowDate)}</td><td>${fmtDate(h.dueDate)}</td><td>${fmtDate(h.returnDate)}</td><td>${result(h.status)}</td></tr>`);
  } else if (ui.ht === 'lent') {
    head = ['Item', 'Borrowed by', 'Borrowed', 'Due', 'Returned', 'Result'];
    rows = [...lent].sort(sortBy).map(h => `<tr><td>${nameOf(h.itemId)}</td><td>${esc(displayName(h.borrowerId))}</td><td>${fmtDate(h.borrowDate)}</td><td>${fmtDate(h.dueDate)}</td><td>${fmtDate(h.returnDate)}</td><td>${result(h.status)}</td></tr>`);
  } else {
    head = ['Item', 'Your role', 'Other student', 'Dates', 'Outcome'];
    rows = getRequests().filter(r => (r.borrowerId === me.email || r.ownerId === me.email) && (r.status === 'Returned' || r.status === 'Declined'))
      .sort((x, y) => y.createdAt.localeCompare(x.createdAt)).map(r => {
        const asBorrower = r.borrowerId === me.email;
        return `<tr><td>${nameOf(r.itemId)}</td><td>${asBorrower ? 'Borrower' : 'Owner'}</td><td>${esc(displayName(asBorrower ? r.ownerId : r.borrowerId))}</td><td>${fmtDate(r.borrowFrom)} to ${fmtDate(r.borrowUntil)}</td><td>${statusChip(r.status)}</td></tr>`;
      });
  }
  const tabs = [['borrowed', 'Borrowed', borrowed.length], ['lent', 'Lent', lent.length], ['requests', 'Previous requests', null]];

  page('History', `
    <div class="page-head"><div>
      <div class="eyebrow">Borrowing history</div>
      <h1 class="page-title">A record of <em>sharing.</em></h1>
    </div></div>
    <div class="stats-3">
      <div class="stat"><b>${borrowed.length}</b><span>items borrowed</span></div>
      <div class="stat"><b>${lent.length}</b><span>items lent</span></div>
      <div class="stat"><b>${onTime}</b><span>returned on time</span></div>
    </div>
    <div class="filter-row" role="group" aria-label="History view">${tabs.map(([id, label, n]) =>
      `<button class="pill ${ui.ht === id ? 'active' : ''}" type="button" data-action="ht" data-id="${id}">${label}${n === null ? '' : ` <small>${n}</small>`}</button>`).join('')}</div>
    ${rows.length ? `<div class="table-wrap"><table><thead><tr>${head.map(h => `<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`
      : `<div class="empty"><h3>Nothing here yet</h3><p>Returned items and finished requests will show up in this list.</p></div>`}`);
}

/* =====================================================================
   Profile (manage account)
   ===================================================================== */
function refreshHeaderUser() {
  $('#avatarBtn').textContent = initial(me.name);
  $('#menuName').textContent = me.name;
  $('#menuEmail').textContent = me.email;
}

function renderProfile() {
  const hist = getHistory();
  const borrowed = hist.filter(h => h.borrowerId === me.email);
  const lent = hist.filter(h => h.ownerId === me.email).length;
  const listed = getItems().filter(i => i.ownerId === me.email).length;
  const onTime = borrowed.filter(h => h.status === 'Returned').length;

  page('Profile', `
    <div class="page-head"><div>
      <div class="eyebrow">Your account</div>
      <h1 class="page-title">Manage your <em>profile.</em></h1>
      <p class="page-sub">This is how other students see you on your listings and requests.</p>
    </div></div>
    <div class="form-layout">
      <div style="display:grid;gap:24px">
        <form class="form-card" id="profileForm" novalidate>
          <h2 class="panel-title">Your details</h2>
          <label class="field">Name<input id="profName" maxlength="50" autocomplete="name" value="${esc(me.name)}" required></label>
          <label class="field">Programme and year<input id="profDept" maxlength="50" value="${esc(me.dept || '')}" placeholder="e.g. BCA · 2nd year"></label>
          <label class="field">College email<input value="${esc(me.email)}" disabled><small>Your email is tied to your campus account and cannot be changed.</small></label>
          <div class="form-error" id="profError" role="alert"></div>
          <div class="form-actions"><button class="button button-dark" type="submit">Save details <span>↗</span></button></div>
        </form>

        <form class="form-card" id="passwordForm" novalidate>
          <h2 class="panel-title">Change password</h2>
          <input type="text" autocomplete="username" value="${esc(me.email)}" hidden>
          <label class="field">Current password<input id="pwCurrent" type="password" autocomplete="current-password"></label>
          <div class="form-row">
            <label class="field">New password<input id="pwNew" type="password" minlength="6" autocomplete="new-password"><small>At least 6 characters.</small></label>
            <label class="field">Confirm new password<input id="pwConfirm" type="password" autocomplete="new-password"></label>
          </div>
          <div class="form-error" id="pwError" role="alert"></div>
          <div class="form-actions"><button class="button button-outline" type="submit">Update password</button></div>
        </form>
      </div>
      <aside class="panel aside-card">
        <div class="eyebrow">Your sharing</div>
        <div style="display:flex;align-items:center;gap:14px;margin:14px 0 18px">
          <span class="avatar" aria-hidden="true">${esc(initial(me.name))}</span>
          <span><b>${esc(me.name)}</b><br><small style="color:var(--muted)">Member since ${fmtDate(me.joined)}</small></span>
        </div>
        <div class="line-row"><span>Items listed</span><b>${listed}</b></div>
        <div class="line-row"><span>Items borrowed</span><b>${borrowed.length}</b></div>
        <div class="line-row"><span>Items lent</span><b>${lent}</b></div>
        <div class="line-row"><span>Returned on time</span><b>${onTime}</b></div>
      </aside>
    </div>`);
}

function submitProfile() {
  const err = $('#profError');
  err.textContent = '';
  const name = $('#profName').value.trim();
  const dept = $('#profDept').value.trim() || 'Student';
  if (name.length < 2) { err.textContent = 'Enter your name (at least 2 characters).'; return; }
  if (!updateProfile(me.email, { name, dept })) { err.textContent = 'Could not save your details. Try again.'; return; }
  me.name = name;
  me.dept = dept;
  refreshHeaderUser();
  toast('Profile updated.');
  rerender();
}

function submitPassword() {
  const err = $('#pwError');
  err.textContent = '';
  const current = $('#pwCurrent').value, next = $('#pwNew').value, confirm = $('#pwConfirm').value;
  if (!current || !next || !confirm) { err.textContent = 'Fill in all three password fields.'; return; }
  if (next.length < 6) { err.textContent = 'Use a new password with at least 6 characters.'; return; }
  if (next !== confirm) { err.textContent = 'The new passwords do not match.'; return; }
  if (changePassword(me.email, current, next) !== 'ok') { err.textContent = 'Your current password is not correct.'; return; }
  toast('Password updated.');
  rerender();
}

/* =====================================================================
   Router
   ===================================================================== */
const ROUTES = [
  [/^profile$/, renderProfile],
  [/^$|^dashboard$/, renderDashboard],
  [/^browse$/, renderBrowse],
  [/^item\/(.+)$/, renderItem],
  [/^list$/, renderList],
  [/^request\/(.+)$/, renderRequestForm],
  [/^requests$/, renderRequests],
  [/^borrowings$/, renderBorrowings],
  [/^my-items$/, renderMyItems],
  [/^history$/, renderHistory]
];
const NAV_OF = { '': 'dashboard', item: 'browse', request: 'browse', list: 'my-items', requests: '', profile: '' };

function renderCurrent(scroll) {
  const path = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
  const hit = ROUTES.find(([re]) => re.test(path));
  if (!hit) { location.hash = '#/dashboard'; return; }
  hit[1](...path.match(hit[0]).slice(1));

  const seg = path.split('/')[0];
  const key = seg in NAV_OF ? NAV_OF[seg] : seg;
  $$('#mainNav a').forEach(a => a.classList.toggle('active', a.dataset.nav === key));
  const waiting = getRequests().filter(r => r.ownerId === me.email && r.status === 'Pending').length;
  const badge = $('#reqBadge');
  badge.textContent = waiting;
  badge.hidden = waiting === 0;
  closeNav();
  if (scroll) { window.scrollTo(0, 0); view.focus({ preventScroll: true }); }
}
const rerender = () => renderCurrent(false);

/* =====================================================================
   Events
   ===================================================================== */
function closeNav() { $('#mainNav').classList.remove('open'); $('#menuToggle').setAttribute('aria-expanded', 'false'); }
function closeMenu() {
  $('#userMenu').hidden = true;
  $('#avatarBtn').setAttribute('aria-expanded', 'false');
  const r = $('#resetBtn');
  r.classList.remove('confirm');
  r.textContent = 'Reset sample data';
}

const actions = {
  'go-cat'(id) { ui.cat = id; ui.q = ''; location.hash = '#/browse'; },
  'filter-cat'(id) {
    ui.cat = id;
    $$('#catRow .pill').forEach(b => b.classList.toggle('active', b.dataset.id === id));
    updateResults();
  },
  'clear-filters'() { Object.assign(ui, { cat: 'All', q: '', avail: 'all', loc: 'All', cond: 'All' }); renderBrowse(); },
  accept(id) {
    toast(respondToRequest(id, true) ? 'Request accepted. Hand it over at the pickup spot.' : 'That item is not free any more.');
    rerender();
  },
  decline(id) { respondToRequest(id, false); toast('Request declined.'); rerender(); },
  collect(id) { confirmCollected(id); toast('Marked as borrowed. Return it by the due date.'); rerender(); },
  'return'(id) {
    const late = markReturned(id);
    toast(late ? 'Marked as returned. It was a little late this time.' : 'Marked as returned. Thanks for sharing.');
    rerender();
  },
  cancel(id) { cancelRequest(id); toast('Request cancelled.'); rerender(); },
  pause(id) { setAvailability(id, 'Paused'); toast('Listing paused. It is hidden from Browse.'); rerender(); },
  resume(id) { setAvailability(id, 'Available'); toast('Your listing is live again.'); rerender(); },
  remove(id) {
    if (ui.pendingRemove === id) {
      removeItem(id);
      ui.pendingRemove = null;
      toast('Listing removed.');
    } else {
      ui.pendingRemove = id;
      setTimeout(() => { if (ui.pendingRemove === id) { ui.pendingRemove = null; if (location.hash === '#/my-items') rerender(); } }, 5000);
    }
    rerender();
  },
  bf(id) { ui.bf = id; rerender(); },
  ht(id) { ui.ht = id; rerender(); },
  logout() { clearSession(); location.href = 'index.html'; },
  reset(id, btn) {
    if (!btn.classList.contains('confirm')) {
      btn.classList.add('confirm');
      btn.textContent = 'Click again to wipe and reseed';
      return;
    }
    resetSampleData();
    ensureUserSeed(me.email);
    closeMenu();
    toast('Sample data restored.');
    if (location.hash === '#/dashboard') rerender(); else location.hash = '#/dashboard';
  }
};

async function syncItemsFromServer() {
  try {
    const response = await fetch(`${API_BASE}/api/items`);
    const result = await response.json();

    if (!response.ok || !result.success || !Array.isArray(result.items)) {
      console.error('Failed to load database items:', result);
      return;
    }

    const localItems = getItems();
    const localById = new Map(localItems.map(item => [item.id, item]));

    const serverItems = result.items.map(item => {
      const old = localById.get(item.id) || {};

      return {
        ...old,
        ...item,
        photo: item.photo || old.photo || null,
        art: item.art || old.art || null,
        createdAt: item.createdAt || old.createdAt || ''
      };
    });

    const serverIds = new Set(serverItems.map(item => item.id));
    const localOnlyItems = localItems.filter(item => !serverIds.has(item.id));

    setItems([...serverItems, ...localOnlyItems]);
    console.log('Database items loaded:', serverItems.length);
  } catch (error) {
    console.error('Database sync failed:', error);
  }
}

function boot() {
  refreshHeaderUser();

  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (btn && actions[btn.dataset.action]) { actions[btn.dataset.action](btn.dataset.id, btn, e); return; }
    if (!e.target.closest('.user-wrap') || e.target.closest('.user-menu a')) closeMenu();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeMenu(); closeNav(); } });

  $('#avatarBtn').addEventListener('click', () => {
    const menu = $('#userMenu');
    const open = menu.hidden;
    if (open) { menu.hidden = false; $('#avatarBtn').setAttribute('aria-expanded', 'true'); } else closeMenu();
  });
  $('#menuToggle').addEventListener('click', () => {
    const nav = $('#mainNav');
    nav.classList.toggle('open');
    $('#menuToggle').setAttribute('aria-expanded', String(nav.classList.contains('open')));
  });

  view.addEventListener('submit', e => {
    e.preventDefault();
    const f = e.target;
    if (f.id === 'dashSearch') { ui.q = $('#dashQ').value.trim(); ui.cat = 'All'; location.hash = '#/browse'; }
    else if (f.id === 'requestForm') submitRequest(f);
    else if (f.id === 'listForm') submitList(f);
    else if (f.id === 'profileForm') submitProfile();
    else if (f.id === 'passwordForm') submitPassword();
    else if (f.id === 'reportForm') {
      reportItem(f.dataset.item, me.email, $('#reportReason').value);
      f.closest('details').open = false;
      toast('Thanks. The campus admin will review this listing.');
    }
  });
  view.addEventListener('input', e => { if (e.target.id === 'q') { ui.q = e.target.value; updateResults(); } });
  view.addEventListener('change', e => {
    const t = e.target;
    if (t.id === 'fAvail') { ui.avail = t.value; updateResults(); }
    else if (t.id === 'fLoc') { ui.loc = t.value; updateResults(); }
    else if (t.id === 'fCond') { ui.cond = t.value; updateResults(); }
    else if (t.id === 'reqFrom') {                      // keep the return date inside the allowed window
      const it = getItem($('#requestForm').dataset.item);
      const until = $('#reqUntil');
      const max = minDate(it.availableUntil, addDays(MAX_LOAN_DAYS - 1, t.value || today()));
      until.min = t.value; until.max = max;
      if (until.value < t.value) until.value = t.value;
      if (until.value > max) until.value = max;
    } else if (t.id === 'itFrom') {
      $('#itUntil').min = t.value;
      if ($('#itUntil').value < t.value) $('#itUntil').value = t.value;
    } else if (t.id === 'itPhoto' && t.files[0]) {
      readPhoto(t.files[0]).then(data => {
        ui.photo = data;
        $('#photoPreview').innerHTML = `<div class="media tone-sage"><img src="${data}" alt="Preview of your photo"></div>`;
      }).catch(() => { $('#listError').textContent = 'That file could not be read as an image.'; });
    }
  });
  window.addEventListener('hashchange', () => renderCurrent(true));
  renderCurrent(true);
  syncItemsFromServer().then(() => renderCurrent(false));
}

if (authed) boot();
