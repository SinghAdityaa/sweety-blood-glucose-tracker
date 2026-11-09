import { useCallback, useEffect, useMemo, useState } from 'react';

const slotLabels = {
  morning_fasting: 'Morning (fasting)',
  after_breakfast: 'After breakfast',
  after_lunch: 'After lunch',
  after_dinner: 'After dinner',
};
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
const dateLabel = (date) => new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));

async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error?.message || 'Something went wrong. Please try again.');
  return payload;
}

function AuthScreen({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      const { user } = await api(`/auth/${mode}`, { method: 'POST', body: JSON.stringify(form) });
      onLogin(user);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <main className="auth-layout">
    <section className="auth-aside"><div className="brand"><span className="brand-mark">s</span> sweety</div><div><p className="eyebrow">A LITTLE MORE IN CONTROL</p><h1>Your daily health,<br /><em>at a glance.</em></h1><p className="aside-copy">Keep your glucose readings together and notice your patterns over time.</p></div><div className="aside-foot">Private by design · Your readings belong to you</div></section>
    <section className="auth-panel"><div className="auth-card"><p className="eyebrow">WELCOME TO SWEETY</p><h2>{mode === 'login' ? 'Good to see you' : 'Create your account'}</h2><p className="muted">{mode === 'login' ? 'Sign in to continue to your tracker.' : 'A calm place to keep track of your readings.'}</p>
      <form onSubmit={submit} className="form-stack">{mode === 'register' && <label>Your name<input autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength="80" /></label>}<label>Email address<input type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label><label>Password<input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength="8" /></label>
      {error && <div className="alert" role="alert">{error}</div>}<button className="primary full" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'} <span>→</span></button></form>
      <p className="switch-auth">{mode === 'login' ? 'New to Sweety?' : 'Already have an account?'} <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>{mode === 'login' ? 'Create an account' : 'Sign in'}</button></p>
    </div><p className="disclaimer">Sweety helps you record information. It does not provide medical advice.</p></section>
  </main>;
}

function StatCard({ label, value, suffix = 'mg/dl', icon, tone }) {
  return <article className={`stat-card ${tone}`}><div className="stat-top"><span>{label}</span><span className="stat-icon">{icon}</span></div><div className="stat-value">{value ?? '—'}<small>{value == null ? '' : suffix}</small></div></article>;
}

function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [selectedDate, setSelectedDate] = useState(today);
  const [reports, setReports] = useState({});
  const [readings, setReadings] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({ slot: 'morning_fasting', value: '' });
  const [editingId, setEditingId] = useState(null);
  const [activeReport, setActiveReport] = useState('daily');
  const load = useCallback(async () => {
    setBusy(true); setError('');
    try {
      const results = await Promise.all(['daily', 'mtd', 'monthly'].map(async (range) => [range, (await api(`/reports?range=${range}&date=${selectedDate}`)).report]));
      const next = Object.fromEntries(results); setReports(next); setReadings(next.daily.readings);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }, [selectedDate]);
  useEffect(() => { api('/auth/me').then(({ user: current }) => setUser(current)).catch(() => {}).finally(() => setChecking(false)); }, []);
  useEffect(() => { if (user) load(); }, [user, load]);
  const occupiedSlots = useMemo(() => new Set(readings.map((r) => r.slot)), [readings]);
  async function saveReading(event) {
    event.preventDefault(); setError(''); setNotice('');
    try {
      const body = { date: selectedDate, slot: form.slot, value: Number(form.value) };
      if (editingId) await api(`/readings/${editingId}`, { method: 'PATCH', body: JSON.stringify(body) });
      else await api('/readings', { method: 'POST', body: JSON.stringify(body) });
      setNotice(editingId ? 'Reading updated.' : 'Reading saved.'); setForm({ slot: 'morning_fasting', value: '' }); setEditingId(null); await load();
    } catch (err) { setError(err.message); }
  }
  function editReading(reading) { setEditingId(reading.id); setForm({ slot: reading.slot, value: String(reading.value) }); setError(''); }
  async function deleteReading(id) {
    if (!window.confirm('Delete this glucose reading?')) return;
    setError(''); setNotice('');
    try { await api(`/readings/${id}`, { method: 'DELETE' }); setNotice('Reading deleted.'); if (editingId === id) setEditingId(null); await load(); }
    catch (err) { setError(err.message); }
  }
  async function signOut() { await api('/auth/logout', { method: 'POST' }).catch(() => {}); setUser(null); setReports({}); setReadings([]); }
  if (checking) return <div className="loading">Opening your tracker…</div>;
  if (!user) return <AuthScreen onLogin={setUser} />;
  const report = reports[activeReport];
  const title = activeReport === 'daily' ? 'Daily report' : activeReport === 'mtd' ? 'Month to date' : 'Previous month';
  return <div className="app-shell"><aside className="sidebar"><div className="brand"><span className="brand-mark">s</span> sweety</div><div className="side-label">YOUR TRACKER</div><button className="nav-item active"><span>◷</span> Glucose overview</button><div className="side-note"><span className="leaf">✳</span><strong>Small steps count.</strong><p>Every entry helps you see the bigger picture.</p></div><div className="profile"><div className="avatar">{user.name?.slice(0, 1).toUpperCase()}</div><div><strong>{user.name}</strong><span>{user.email}</span></div><button className="icon-button" title="Sign out" onClick={signOut}>↗</button></div></aside>
    <main className="main-content"><header className="topbar"><div className="breadcrumb">My tracker <span>/</span> <strong>Overview</strong></div><div className="topbar-right"><span className="privacy-chip"><i /> Private & secure</span><div className="top-avatar">{user.name?.slice(0, 1).toUpperCase()}</div></div></header>
      <section className="welcome-row"><div><p className="eyebrow">YOUR HEALTH SNAPSHOT</p><h1>Good day, {user.name?.split(' ')[0]} <span className="wave">✳</span></h1><p className="muted">A clear view of your readings, one day at a time.</p></div><label className="date-picker"><span>Viewing date</span><input type="date" max={today()} value={selectedDate} onChange={(e) => { setSelectedDate(e.target.value); setActiveReport('daily'); }} /></label></section>
      <div className="section-heading"><div><h2>At a glance</h2><p>{dateLabel(selectedDate)} · {busy ? 'Updating…' : `${readings.length} of 4 readings`}</p></div><span className="unit-chip">mg/dl</span></div>
      <section className="stats-grid"><StatCard label="Highest" value={reports.daily?.highest} icon="↗" tone="peach" /><StatCard label="Lowest" value={reports.daily?.lowest} icon="↘" tone="mint" /><StatCard label="Daily average" value={reports.daily?.average} icon="⌁" tone="lavender" /><StatCard label="Readings logged" value={reports.daily?.count ?? 0} suffix="/ 4" icon="▤" tone="cream" /></section>
      <div className="content-grid"><section className="panel readings-panel"><div className="panel-heading"><div><h2>Today’s readings</h2><p>One reading for each time slot</p></div><span className="count-pill">{readings.length} / 4</span></div>
        {error && <div className="alert" role="alert">{error}</div>}{notice && <div className="success" role="status">{notice}</div>}
        {readings.length ? <div className="reading-list">{readings.map((reading, index) => <article className="reading-row" key={reading.id}><div className={`reading-dot dot-${index}`}><span>◷</span></div><div className="reading-info"><strong>{reading.slotLabel}</strong><span>{dateLabel(reading.date)}</span></div><div className="reading-number">{reading.value}<small>mg/dl</small></div><button className="text-action" onClick={() => editReading(reading)}>Edit</button><button className="delete-action" aria-label={`Delete ${reading.slotLabel} reading`} onClick={() => deleteReading(reading.id)}>×</button></article>)}</div> : <div className="empty-state"><div className="empty-illustration">◌</div><strong>No readings for this day yet</strong><span>Add your first reading to get started.</span></div>}
        {(readings.length < 4 || editingId) && <form className="add-form" onSubmit={saveReading}><div className="form-title"><span className="plus">{editingId ? '↻' : '+'}</span><div><strong>{editingId ? 'Edit reading' : 'Add a reading'}</strong><span>{editingId ? 'Update the selected entry.' : 'Log a reading for this date.'}</span></div></div><label>Time slot<select value={form.slot} onChange={(e) => setForm({ ...form, slot: e.target.value })}>{Object.entries(slotLabels).map(([key, label]) => <option key={key} value={key} disabled={!editingId && occupiedSlots.has(key)}>{label}{occupiedSlots.has(key) && !editingId ? ' · logged' : ''}</option>)}</select></label><label>Glucose value<input type="number" inputMode="numeric" min="40" max="600" step="1" placeholder="e.g. 108" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /><span className="input-suffix">mg/dl</span></label><div className="form-actions">{editingId && <button type="button" className="secondary" onClick={() => { setEditingId(null); setForm({ slot: 'morning_fasting', value: '' }); setError(''); }}>Cancel</button>}<button className="primary" disabled={busy}>{editingId ? 'Save changes' : 'Save reading'} <span>→</span></button></div></form>}
      </section><section className="panel report-panel"><div className="panel-heading"><div><h2>Reports</h2><p>See your readings over time</p></div><span className="report-icon">⌁</span></div><div className="report-tabs" role="tablist">{[['daily','Daily'],['mtd','Month to date'],['monthly','Previous month']].map(([key,label])=><button role="tab" aria-selected={activeReport === key} className={activeReport === key ? 'selected' : ''} key={key} onClick={() => setActiveReport(key)}>{label}</button>)}</div>
        <div className="report-range"><span className="calendar-icon">▦</span><div><strong>{title}</strong><span>{report?.label || 'Loading range…'}</span></div></div><div className="report-stats"><div><span>Highest</span><strong>{report?.highest == null ? '—' : `${report.highest}`}<small>{report?.highest == null ? '' : ' mg/dl'}</small></strong></div><div><span>Lowest</span><strong>{report?.lowest == null ? '—' : `${report.lowest}`}<small>{report?.lowest == null ? '' : ' mg/dl'}</small></strong></div><div><span>Average</span><strong>{report?.average == null ? '—' : `${report.average}`}<small>{report?.average == null ? '' : ' mg/dl'}</small></strong></div></div><div className="report-footer"><span>Readings in period</span><strong>{report?.count ?? 0}</strong></div><div className="report-empty">{report?.count ? 'Your report is up to date.' : 'No readings in this period yet. Your report will appear here once you log a reading.'}</div></section></div>
      <footer className="page-footer"><span>✳ &nbsp;One day at a time.</span><span>Sweety · Personal glucose tracker</span></footer>
    </main></div>;
}

export default App;
