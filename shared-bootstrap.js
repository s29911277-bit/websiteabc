/* Load shared PostgreSQL data before the page's app scripts read localStorage. */
(async () => {
  const localHost = ['localhost', '127.0.0.1'].includes(location.hostname);
  const api = window.BORROWBOX_API || (localHost ? 'http://localhost:3000' : location.origin);
  const apiKey = window.BORROWBOX_API_KEY || localStorage.getItem('bb_api_token') || 'borrowbox-demo-key';
  try { localStorage.setItem('bb_api_token', apiKey); } catch (_error) { /* ignore */ }
  const authHeaders = { Authorization: `Bearer ${apiKey}` };
  let loadedSharedState = false;
  try {
    const response = await fetch(`${api}/api/state`, { headers: authHeaders });
    if (!response.ok) throw new Error(`API returned ${response.status}`);
    const { success, state } = await response.json();
    if (success && state) {
      loadedSharedState = true;
      for (const key of ['users', 'items', 'requests', 'history', 'reports']) {
        localStorage.setItem(`bb_${key}`, JSON.stringify(state[key] ?? (key === 'users' ? {} : [])));
      }
    }
  } catch (error) {
    console.warn('Shared PostgreSQL data is unavailable; using this browser\'s saved data.', error.message);
  }

  const scripts = document.body.dataset.scripts.split(',');
  for (const src of scripts) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Could not load ${src}`));
      document.body.append(script);
    });
  }
  if (!loadedSharedState) {
    await new Promise(resolve => setTimeout(resolve, 250));
    const state = Object.fromEntries(['users', 'items', 'requests', 'history', 'reports'].map(key => {
      const fallback = key === 'users' ? {} : [];
      try { return [key, JSON.parse(localStorage.getItem(`bb_${key}`) || JSON.stringify(fallback))]; }
      catch (_error) { return [key, fallback]; }
    }));
    try {
      await fetch(`${api}/api/state`, {
        method: 'PUT', headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ state })
      });
    } catch (error) {
      console.warn('Could not initialize PostgreSQL shared data:', error.message);
    }
  }
})().catch(error => console.error('BorrowBox could not initialize:', error));
