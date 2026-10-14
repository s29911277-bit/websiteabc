/* BorrowBox · landing page: log in, register, demo account */

initData();

const form = document.querySelector('#studentForm');
const errorBox = document.querySelector('#formError');
let mode = 'login';

/* Illustration tiles under the headline */
document.querySelectorAll('.item-strip li').forEach(li => {
  const label = li.textContent;
  li.innerHTML = `<div class="media tone-${li.dataset.tone}">${artSvg(li.dataset.art)}</div>${label}`;
});

/* Already signed in? Offer a shortcut instead of the form. */
(function showSession() {
  const s = getSession();
  const u = s && userOf(s.email);
  if (!u || u.suspended) return;
  document.querySelector('#authForm').hidden = true;
  document.querySelector('#welcomeBack').hidden = false;
  document.querySelector('#welcomeTitle').innerHTML = `Hi ${escapeHtml(u.name.split(' ')[0])}, <em>welcome back.</em>`;
})();

document.querySelector('#logoutBtn').addEventListener('click', () => {
  clearSession();
  location.reload();
});

function escapeHtml(v) {
  return String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function setMode(next) {
  mode = next;
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.toggle('active', t.dataset.mode === mode));
  document.querySelector('#nameField').hidden = mode !== 'register';
  document.querySelector('#nameInput').required = mode === 'register';
  document.querySelector('#authTitle').innerHTML = mode === 'login' ? 'Welcome <em>back.</em>' : 'Join the <em>sharing loop.</em>';
  document.querySelector('#authSub').textContent = mode === 'login'
    ? 'Log in with your college email to continue.'
    : 'Create your student account with your college email.';
  document.querySelector('#submitBtn').innerHTML = mode === 'login' ? 'Log in <span>↗</span>' : 'Create account <span>↗</span>';
  form.querySelector('[name=password]').autocomplete = mode === 'login' ? 'current-password' : 'new-password';
  errorBox.textContent = '';
  form.reset();
}
document.querySelectorAll('.auth-tab').forEach(t => t.addEventListener('click', () => setMode(t.dataset.mode)));

function finishLogin(user) {
  setSession(user);
  ensureUserSeed(user.email);
  location.href = 'app.html';
}

form.addEventListener('submit', e => {
  e.preventDefault();
  errorBox.textContent = '';
  const data = new FormData(form);
  const name = String(data.get('name') || '').trim();
  const email = String(data.get('email') || '').trim().toLowerCase();
  const password = String(data.get('password') || '');
  const suffix = '@' + COLLEGE_DOMAIN;

  if (!email.endsWith(suffix) || email.slice(0, -suffix.length).includes('@') || email.length === suffix.length) {
    errorBox.textContent = `Use your ${suffix} student email.`;
    return;
  }
  const users = getUsers();

  if (mode === 'register') {
    if (!name) { errorBox.textContent = 'Please enter your name.'; return; }
    if (password.length < 6) { errorBox.textContent = 'Use a password with at least 6 characters.'; return; }
    if (users[email] && users[email].password) { errorBox.textContent = 'An account already exists for this email. Log in instead.'; return; }
    users[email] = { name, email, password, role: 'student', dept: 'Student', joined: today(), suspended: false };
    setUsers(users);
    finishLogin(users[email]);
    return;
  }

  const u = users[email];
  if (!u || !u.password || u.password !== password) { errorBox.textContent = 'That email and password do not match an account.'; return; }
  if (u.suspended) { errorBox.textContent = 'This account has been suspended. Contact the campus admin.'; return; }
  finishLogin(u);
});

/* One click into a fully populated account, handy for demos and viva. */
document.querySelector('#demoBtn').addEventListener('click', () => {
  const users = getUsers();
  const email = E('demo');
  if (!users[email]) {
    users[email] = { name: 'Demo Student', email, password: 'demo123', role: 'student', dept: 'BCA · 2nd year', joined: today(), suspended: false };
    setUsers(users);
  }
  finishLogin(users[email]);
});
