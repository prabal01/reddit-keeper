/**
 * mockup-screenshots.mjs
 * Builds standalone HTML mockups with realistic data, then screenshots each one.
 * No running server needed.
 *
 * Usage: node scripts/mockup-screenshots.mjs
 */

import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR  = path.join(__dirname, '../marketing/public/docs');
const TMP_DIR  = path.join(__dirname, '../.mockup-tmp');
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(TMP_DIR, { recursive: true });

// ─── Shared shell (sidebar + topbar) ──────────────────────────────────────────

const FONT = `https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap`;

const CSS_VARS = `
  :root {
    --bg-primary:   #0f0f17;
    --bg-secondary: #1a1a2e;
    --bg-tertiary:  #16162a;
    --bg-input:     #1e1e38;
    --bg-hover:     #252545;
    --bg-accent:    #ff4500;
    --bg-accent-alpha: rgba(255,69,0,0.12);
    --text-primary:   #e8e8f0;
    --text-secondary: #a0a0b8;
    --text-tertiary:  #60608a;
    --border:       #2a2a4a;
    --border-light: #1e1e38;
    --radius-sm: 8px;
    --radius-md: 12px;
    --radius-lg: 16px;
    --radius-xl: 20px;
    --radius-full: 9999px;
    --shadow-md: 0 4px 16px rgba(0,0,0,0.3);
    --shadow-lg: 0 8px 32px rgba(0,0,0,0.4);
    --sidebar-width: 240px;
  }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', sans-serif; background: var(--bg-primary); color: var(--text-primary); font-size: 14px; line-height: 1.5; -webkit-font-smoothing: antialiased; }
  a { color: inherit; text-decoration: none; }
`;

function badge(text, color = '#ff4500', bg = 'rgba(255,69,0,0.12)') {
  return `<span style="display:inline-flex;align-items:center;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:700;background:${bg};color:${color};border:1px solid ${color}22;">${text}</span>`;
}

function shell(activeNav, content) {
  const navItems = [
    { label: 'Monitoring', icon: '◎', href: '#' },
    { label: 'Leads',      icon: '◈', href: '#' },
    { label: 'Reports',    icon: '◧', href: '#' },
  ];
  const monitors = [
    { name: 'Calendly alternatives', color: '#ff4500' },
    { name: 'async standup tools',   color: '#ff4500' },
    { name: 'notion-for-startups.com', color: '#3b82f6' },
  ];
  return `<!DOCTYPE html>
<html data-theme="dark">
<head>
<meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="${FONT}" rel="stylesheet">
<style>
${CSS_VARS}
html,body { height: 100%; overflow: hidden; }
.app { display:flex; height:100vh; }

/* ── Sidebar ── */
.sidebar {
  width: var(--sidebar-width);
  background: var(--bg-primary);
  border-right: 1px solid var(--border);
  display: flex; flex-direction: column;
  flex-shrink: 0;
  padding: 0 0 20px;
}
.sidebar-logo {
  padding: 20px 20px 16px;
  border-bottom: 1px solid var(--border);
  display: flex; align-items: center; gap: 10px;
  margin-bottom: 12px;
}
.logo-icon {
  width: 30px; height: 30px;
  background: var(--bg-accent);
  border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; font-weight: 900; color: #fff;
}
.logo-text { font-size: 14px; font-weight: 800; color: var(--text-primary); }
.nav-link {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 20px; font-size: 13px; font-weight: 600;
  color: var(--text-secondary); border-radius: 0;
  transition: all .15s; cursor: pointer;
}
.nav-link:hover, .nav-link.active {
  color: var(--bg-accent); background: var(--bg-accent-alpha);
}
.nav-section-label {
  padding: 16px 20px 6px;
  font-size: 10px; font-weight: 700; letter-spacing: .08em;
  text-transform: uppercase; color: var(--text-tertiary);
}
.monitor-item {
  display: flex; align-items: center; gap: 8px;
  padding: 7px 20px; font-size: 12px; font-weight: 600;
  color: var(--text-secondary); cursor: pointer; transition: color .15s;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.monitor-item:hover { color: var(--text-primary); }
.monitor-dot { width:6px;height:6px;border-radius:50%;flex-shrink:0; }
.sidebar-footer { margin-top: auto; border-top: 1px solid var(--border); padding-top: 8px; }
.sidebar-footer .nav-link { font-size: 12px; }

/* ── Main ── */
.main { flex:1; overflow-y:auto; display:flex; flex-direction:column; }
.topbar {
  height: 56px; border-bottom: 1px solid var(--border);
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 28px; background: var(--bg-primary); flex-shrink:0;
}
.topbar-title { font-size: 15px; font-weight: 800; color: var(--text-primary); }
.topbar-right { display:flex; align-items:center; gap:10px; }
.avatar {
  width:30px;height:30px;border-radius:50%;
  background: linear-gradient(135deg,#ff4500,#ff8717);
  display:flex;align-items:center;justify-content:center;
  font-size:12px;font-weight:800;color:#fff;
}
.content { padding: 28px; flex:1; }
</style>
</head>
<body>
<div class="app">
  <!-- Sidebar -->
  <aside class="sidebar">
    <div class="sidebar-logo">
      <div class="logo-icon">O</div>
      <div class="logo-text">OpinionDeck</div>
    </div>
    ${navItems.map(n => `<a class="nav-link${n.label === activeNav ? ' active' : ''}" href="#">
      <span style="font-size:16px;width:18px;text-align:center;">${n.icon}</span>
      ${n.label}
    </a>`).join('')}
    <div class="nav-section-label">Active Monitors</div>
    ${monitors.map(m => `<div class="monitor-item">
      <div class="monitor-dot" style="background:${m.color};"></div>
      <span style="overflow:hidden;text-overflow:ellipsis;">${m.name}</span>
    </div>`).join('')}
    <div class="sidebar-footer">
      <a class="nav-link" href="#" style="font-size:12px;color:var(--text-tertiary);">⚙ Settings</a>
      <a class="nav-link" href="#" style="font-size:12px;color:var(--bg-accent);font-weight:700;">↑ Upgrade Plan</a>
    </div>
  </aside>
  <!-- Main -->
  <div class="main">
    <div class="topbar">
      <span class="topbar-title">${activeNav}</span>
      <div class="topbar-right">
        <div class="avatar">P</div>
      </div>
    </div>
    <div class="content">${content}</div>
  </div>
</div>
</body>
</html>`;
}

// ─── Page builders ─────────────────────────────────────────────────────────────

function buildSignup() {
  return `<!DOCTYPE html>
<html data-theme="dark">
<head>
<meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="${FONT}" rel="stylesheet">
<style>
${CSS_VARS}
html,body{height:100%;overflow:hidden;}
body { display:flex; align-items:center; justify-content:center;
  background: radial-gradient(ellipse at 60% 20%, rgba(255,69,0,0.08) 0%, transparent 60%), var(--bg-primary); }
.card {
  width: 420px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  padding: 40px;
  box-shadow: var(--shadow-lg), 0 0 80px rgba(255,69,0,0.06);
}
.logo { display:flex;align-items:center;gap:10px;margin-bottom:32px;justify-content:center; }
.logo-icon { width:36px;height:36px;background:var(--bg-accent);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:900;color:#fff; }
.logo-text { font-size:16px;font-weight:800;color:var(--text-primary); }
h2 { font-size:22px;font-weight:800;color:var(--text-primary);margin-bottom:6px;text-align:center; }
.subtitle { font-size:13px;color:var(--text-secondary);text-align:center;margin-bottom:28px; }
label { display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-tertiary);margin-bottom:6px; }
input {
  width:100%;background:var(--bg-input);border:1px solid var(--border);
  border-radius:var(--radius-sm);padding:11px 14px;color:var(--text-primary);
  font-size:14px;margin-bottom:16px;font-family:inherit;outline:none;
}
input:focus { border-color:var(--bg-accent); box-shadow: 0 0 0 3px var(--bg-accent-alpha); }
.btn-primary {
  width:100%;background:var(--bg-accent);color:#fff;border:none;
  border-radius:var(--radius-sm);padding:13px;font-size:14px;font-weight:700;
  cursor:pointer;margin-top:4px;font-family:inherit;
  background: linear-gradient(135deg,#ff4500,#ff6a00);
  box-shadow: 0 4px 16px rgba(255,69,0,0.35);
}
.divider { display:flex;align-items:center;gap:12px;margin:20px 0;color:var(--text-tertiary);font-size:12px; }
.divider::before,.divider::after { content:'';flex:1;height:1px;background:var(--border); }
.btn-secondary {
  width:100%;background:transparent;border:1px solid var(--border);
  border-radius:var(--radius-sm);padding:12px;font-size:13px;font-weight:600;
  cursor:pointer;color:var(--text-secondary);font-family:inherit;
  display:flex;align-items:center;justify-content:center;gap:8px;
}
.already { text-align:center;margin-top:20px;font-size:13px;color:var(--text-tertiary); }
.already a { color:var(--bg-accent);font-weight:600; }
</style>
</head>
<body>
<div class="card">
  <div class="logo">
    <div class="logo-icon">O</div>
    <div class="logo-text">OpinionDeck</div>
  </div>
  <h2>Create your account</h2>
  <p class="subtitle">Start finding product opportunities in minutes</p>
  <label>Email address</label>
  <input type="email" placeholder="name@company.com" value="" />
  <label>Password</label>
  <input type="password" placeholder="••••••••" />
  <button class="btn-primary">Create Account →</button>
  <div class="divider">or</div>
  <button class="btn-secondary">
    <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
    Continue with Google
  </button>
  <p class="already">Already have an account? <a href="#">Sign in</a></p>
</div>
</body>
</html>`;
}

function buildDashboard() {
  const monitors = [
    { name: 'Calendly alternatives',      type: 'Niche monitor',   leads: 47, signals: 12, scan: '2 hours ago',  color: '#ff4500' },
    { name: 'async standup tools',         type: 'Niche monitor',   leads: 23, signals: 8,  scan: '4 hours ago',  color: '#ff4500' },
    { name: 'notion-for-startups.com',     type: 'Website monitor', leads: 91, signals: 19, scan: '1 hour ago',   color: '#3b82f6' },
  ];
  const cards = monitors.map(m => `
    <div style="padding:24px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-xl);cursor:pointer;transition:all .2s;">
      <div style="display:flex;justify-content:between;align-items:start;margin-bottom:16px;">
        <div style="display:flex;align-items:center;gap:6px;flex:1;">
          <span style="font-size:12px;color:${m.color};">${m.type === 'Website monitor' ? '🌐' : '◎'}</span>
          <span style="font-size:11px;color:var(--text-tertiary);font-weight:600;">${m.type}</span>
        </div>
        ${badge('Live', '#22c55e', 'rgba(34,197,94,0.1)')}
      </div>
      <div style="font-size:16px;font-weight:800;color:var(--text-primary);margin-bottom:20px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${m.name}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
        <div>
          <div style="font-size:10px;color:var(--text-tertiary);font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;">Leads</div>
          <div style="font-size:28px;font-weight:900;color:var(--text-primary);">${m.leads}</div>
        </div>
        <div>
          <div style="font-size:10px;color:var(--text-tertiary);font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;">Signals</div>
          <div style="font-size:28px;font-weight:900;color:var(--text-primary);">${m.signals}</div>
        </div>
      </div>
      <div style="border-top:1px solid var(--border-light);padding-top:12px;display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:11px;color:var(--text-tertiary);">⏱ Last scan ${m.scan}</span>
        <span style="font-size:11px;color:var(--bg-accent);font-weight:700;">View Inbox →</span>
      </div>
    </div>`).join('');

  const content = `
    <div style="max-width:860px;">
      <div style="margin-bottom:28px;">
        <h1 style="font-size:24px;font-weight:900;color:var(--text-primary);margin-bottom:6px;">Market Intelligence</h1>
        <p style="font-size:14px;color:var(--text-secondary);">Your monitors are actively scanning Reddit for opportunities.</p>
      </div>
      <!-- Input bar -->
      <div style="display:flex;align-items:center;gap:10px;padding:6px 6px 6px 18px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-full);margin-bottom:32px;">
        <span style="color:var(--text-tertiary);font-size:16px;">🔍</span>
        <span style="flex:1;color:var(--text-tertiary);font-size:14px;">Describe your product or a competitor to monitor…</span>
        <button style="background:var(--bg-accent);color:#fff;border:none;border-radius:var(--radius-full);padding:10px 22px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">Propose subreddits</button>
      </div>
      <!-- Monitors grid -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <h2 style="font-size:16px;font-weight:800;color:var(--text-primary);">My Monitors</h2>
        <span style="font-size:11px;color:var(--text-tertiary);">3 of 10 active</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;">${cards}</div>
    </div>`;
  return shell('Monitoring', content);
}

function buildDiscoverySearch() {
  const content = `
    <div style="max-width:780px;margin:0 auto;padding-top:32px;">
      <div style="text-align:center;margin-bottom:40px;">
        <h1 style="font-size:28px;font-weight:900;color:var(--text-primary);margin-bottom:8px;letter-spacing:-.02em;">Discovery Lab</h1>
        <p style="font-size:15px;color:var(--text-secondary);">Find what your market is really saying on Reddit & HN</p>
      </div>
      <!-- Search bar -->
      <div style="background:var(--bg-secondary);border:1px solid var(--bg-accent);border-radius:var(--radius-full);padding:10px 10px 10px 24px;box-shadow:0 0 0 4px rgba(255,69,0,0.10),var(--shadow-md);display:flex;align-items:center;gap:12px;margin-bottom:20px;">
        <span style="color:var(--bg-accent);font-size:16px;">🔍</span>
        <span style="flex:1;font-size:16px;font-weight:600;color:var(--text-primary);">Calendly alternatives for small teams</span>
        <div style="display:flex;align-items:center;gap:8px;">
          <!-- AI Brain toggle ON -->
          <div style="display:flex;align-items:center;gap:6px;padding:6px 12px;background:rgba(255,69,0,0.15);border:1px solid rgba(255,69,0,0.4);border-radius:var(--radius-full);">
            <span style="font-size:12px;">🧠</span>
            <span style="font-size:12px;font-weight:700;color:var(--bg-accent);">AI Brain</span>
            <div style="width:28px;height:16px;background:var(--bg-accent);border-radius:99px;position:relative;">
              <div style="position:absolute;right:2px;top:2px;width:12px;height:12px;background:#fff;border-radius:50%;"></div>
            </div>
          </div>
          <button style="background:var(--bg-accent);color:#fff;border:none;border-radius:var(--radius-full);padding:10px 24px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;background:linear-gradient(135deg,#ff4500,#ff6a00);box-shadow:0 4px 14px rgba(255,69,0,0.35);">Search</button>
        </div>
      </div>
      <!-- Platform filter -->
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:40px;justify-content:center;">
        <button style="padding:6px 16px;border-radius:var(--radius-full);background:var(--bg-accent);color:#fff;border:none;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">All</button>
        <button style="padding:6px 16px;border-radius:var(--radius-full);background:var(--bg-tertiary);color:var(--text-secondary);border:1px solid var(--border);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;">Reddit</button>
        <button style="padding:6px 16px;border-radius:var(--radius-full);background:var(--bg-tertiary);color:var(--text-secondary);border:1px solid var(--border);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;">HN</button>
      </div>
      <!-- Hint cards -->
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
        ${[
          { icon:'🎯', title:'Competitor Discovery', desc:'Enter a product name to find frustration threads and alternative-seekers' },
          { icon:'💡', title:'Idea Discovery', desc:'Describe a market and AI Brain expands it to multiple search angles' },
          { icon:'🌐', title:'URL / Website', desc:'Paste any product URL and we\'ll auto-detect and research it' },
        ].map(h => `<div style="padding:20px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-lg);">
          <div style="font-size:20px;margin-bottom:10px;">${h.icon}</div>
          <div style="font-size:13px;font-weight:700;color:var(--text-primary);margin-bottom:6px;">${h.title}</div>
          <div style="font-size:12px;color:var(--text-secondary);line-height:1.5;">${h.desc}</div>
        </div>`).join('')}
      </div>
    </div>`;
  return shell('Discovery Lab', content);
}

function buildDiscoveryResults() {
  const results = [
    { title: 'Calendly is broken for any team over 5 people — what are you all using instead?', sub: 'r/productivity', score: 1847, comments: 312, tags: ['frustration','alternative'], time: '3 days ago' },
    { title: 'We switched from Calendly to [X] and never looked back — here\'s why', sub: 'r/startups', score: 934, comments: 187, tags: ['alternative','high-engagement'], time: '1 week ago' },
    { title: 'Comparing Calendly vs Acuity vs Cal.com for a 12-person sales team', sub: 'r/sales', score: 621, comments: 94, tags: ['question','high-engagement'], time: '5 days ago' },
    { title: 'Does anyone know a Calendly alternative that doesn\'t charge per seat?', sub: 'r/entrepreneur', score: 408, comments: 73, tags: ['alternative','frustration'], time: '2 weeks ago' },
    { title: 'Calendly\'s new pricing just killed our budget — open to suggestions', sub: 'r/smallbusiness', score: 289, comments: 61, tags: ['frustration'], time: '4 days ago' },
  ];
  const intentColors = {
    frustration:    { color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
    alternative:    { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
    'high-engagement': { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
    question:       { color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
  };
  const cards = results.map(r => `
    <div style="padding:18px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-lg);display:flex;gap:16px;align-items:flex-start;">
      <input type="checkbox" style="margin-top:3px;accent-color:var(--bg-accent);width:15px;height:15px;flex-shrink:0;" />
      <div style="flex:1;min-width:0;">
        <div style="font-size:14px;font-weight:700;color:var(--text-primary);margin-bottom:8px;line-height:1.4;">${r.title}</div>
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;flex-wrap:wrap;">
          <span style="font-size:11px;font-weight:700;color:var(--bg-accent);">${r.sub}</span>
          <span style="font-size:11px;color:var(--text-tertiary);">▲ ${r.score.toLocaleString()}</span>
          <span style="font-size:11px;color:var(--text-tertiary);">💬 ${r.comments}</span>
          <span style="font-size:11px;color:var(--text-tertiary);">${r.time}</span>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          ${r.tags.map(t => {
            const c = intentColors[t] || { color: '#a0a0b8', bg: 'rgba(160,160,184,0.1)' };
            return `<span style="padding:2px 8px;border-radius:99px;font-size:10px;font-weight:700;background:${c.bg};color:${c.color};border:1px solid ${c.color}33;">${t}</span>`;
          }).join('')}
        </div>
      </div>
      <button style="padding:6px 14px;background:transparent;border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-tertiary);font-size:12px;cursor:pointer;flex-shrink:0;font-family:inherit;">↗ Open</button>
    </div>`).join('');

  const content = `
    <div style="max-width:820px;margin:0 auto;">
      <!-- Search bar compact -->
      <div style="display:flex;align-items:center;gap:10px;padding:8px 8px 8px 18px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-full);margin-bottom:24px;">
        <span style="color:var(--bg-accent);font-size:14px;">🔍</span>
        <span style="flex:1;font-size:14px;font-weight:600;color:var(--text-primary);">Calendly alternatives for small teams</span>
        <div style="display:flex;align-items:center;gap:6px;padding:5px 10px;background:rgba(255,69,0,0.15);border:1px solid rgba(255,69,0,0.3);border-radius:var(--radius-full);">
          <span style="font-size:11px;">🧠</span>
          <span style="font-size:11px;font-weight:700;color:var(--bg-accent);">AI Brain</span>
        </div>
        <button style="background:var(--bg-accent);color:#fff;border:none;border-radius:var(--radius-full);padding:8px 20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">Search</button>
      </div>
      <!-- Results header -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <div>
          <span style="font-size:14px;font-weight:800;color:var(--text-primary);">127 results</span>
          <span style="font-size:13px;color:var(--text-tertiary);margin-left:8px;">across Reddit &amp; HN · 3 search angles</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <button style="padding:6px 14px;background:var(--bg-accent);color:#fff;border:none;border-radius:var(--radius-sm);font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">Save 5 selected</button>
          <select style="background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);padding:6px 10px;color:var(--text-secondary);font-size:12px;font-family:inherit;">
            <option>Sort: Best match</option>
          </select>
        </div>
      </div>
      <!-- Results -->
      <div style="display:flex;flex-direction:column;gap:10px;">${cards}</div>
    </div>`;
  return shell('Discovery Lab', content);
}

function buildMonitoringCreate() {
  const subreddits = ['productivity', 'startups', 'entrepreneur', 'smallbusiness', 'saas', 'digitalnomad', 'remotework', 'Calendly'];
  const pills = subreddits.map((s, i) => `
    <div style="display:flex;align-items:center;gap:8px;padding:7px 12px;background:var(--bg-tertiary);border:1px solid var(--border-light);border-radius:var(--radius-sm);font-size:13px;font-weight:600;color:var(--text-primary);">
      r/${s}
      <button style="background:transparent;border:none;color:var(--text-tertiary);cursor:pointer;font-size:14px;line-height:1;">×</button>
    </div>`).join('');

  const content = `
    <div style="max-width:680px;">
      <div style="margin-bottom:28px;">
        <h1 style="font-size:22px;font-weight:900;color:var(--text-primary);margin-bottom:6px;">Create a Monitor</h1>
        <p style="font-size:14px;color:var(--text-secondary);">OpinionDeck found 8 relevant communities for your product.</p>
      </div>
      <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-xl);padding:32px;box-shadow:var(--shadow-lg);">
        <!-- Monitor name -->
        <div style="margin-bottom:20px;">
          <label style="display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-tertiary);margin-bottom:8px;">Monitor Name</label>
          <input type="text" value="Calendly alternatives" style="width:100%;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);padding:11px 14px;color:var(--text-primary);font-size:14px;font-family:inherit;outline:none;" readonly />
        </div>
        <!-- Website context -->
        <div style="margin-bottom:20px;">
          <label style="display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-tertiary);margin-bottom:8px;">Website Context</label>
          <textarea rows="3" style="width:100%;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);padding:11px 14px;color:var(--text-primary);font-size:14px;font-family:inherit;resize:none;outline:none;" readonly>Scheduling tool alternative for small businesses and freelancers frustrated with Calendly's pricing and complexity</textarea>
        </div>
        <!-- Subreddits -->
        <div style="margin-bottom:28px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <label style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-tertiary);">Subreddits to Watch <span style="color:var(--bg-accent);">AI Proposed</span></label>
            <span style="font-size:11px;color:var(--text-tertiary);">8 communities</span>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:8px;padding:16px;background:var(--bg-tertiary);border:1px solid var(--border-light);border-radius:var(--radius-md);">
            ${pills}
            <button style="display:flex;align-items:center;gap:6px;padding:7px 14px;background:transparent;border:1px dashed var(--bg-accent);border-radius:var(--radius-sm);color:var(--bg-accent);font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">+ Add subreddit</button>
          </div>
        </div>
        <!-- Actions -->
        <div style="display:flex;justify-content:flex-end;gap:12px;padding-top:20px;border-top:1px solid var(--border-light);">
          <button style="padding:11px 22px;background:transparent;border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-secondary);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;">Cancel</button>
          <button style="padding:11px 28px;background:linear-gradient(135deg,#ff4500,#ff6a00);color:#fff;border:none;border-radius:var(--radius-sm);font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;box-shadow:0 4px 14px rgba(255,69,0,0.35);">Start Monitoring →</button>
        </div>
      </div>
    </div>`;
  return shell('Monitoring', content);
}

function buildFoldersList() {
  const decks = [
    { name: 'Calendly Competitors',       threads: 23, leads: 47, lastUpdate: '2h ago',  color: '#ff4500', active: true  },
    { name: 'Async Standup Tools',         threads: 11, leads: 23, lastUpdate: '4h ago',  color: '#ff4500', active: true  },
    { name: 'Notion Pain Points',          threads: 34, leads: 91, lastUpdate: '1d ago',  color: '#3b82f6', active: true  },
    { name: 'Remote Work Frustrations',    threads: 18, leads: 34, lastUpdate: '3d ago',  color: '#8b5cf6', active: false },
    { name: 'Project Management Alt.',     threads: 8,  leads: 15, lastUpdate: '1w ago',  color: '#22c55e', active: false },
  ];
  const cards = decks.map(d => `
    <div style="padding:20px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-xl);cursor:pointer;transition:all .2s;">
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:14px;">
        <div style="width:36px;height:36px;border-radius:var(--radius-sm);background:${d.color}20;border:1px solid ${d.color}33;display:flex;align-items:center;justify-content:center;font-size:16px;">📁</div>
        ${d.active ? badge('Monitor Active', '#22c55e', 'rgba(34,197,94,0.1)') : badge('No Monitor', '#60608a', 'rgba(96,96,138,0.1)')}
      </div>
      <div style="font-size:15px;font-weight:800;color:var(--text-primary);margin-bottom:14px;">${d.name}</div>
      <div style="display:flex;gap:16px;">
        <div>
          <div style="font-size:10px;color:var(--text-tertiary);font-weight:700;text-transform:uppercase;margin-bottom:2px;">Threads</div>
          <div style="font-size:20px;font-weight:900;color:var(--text-primary);">${d.threads}</div>
        </div>
        <div>
          <div style="font-size:10px;color:var(--text-tertiary);font-weight:700;text-transform:uppercase;margin-bottom:2px;">Leads</div>
          <div style="font-size:20px;font-weight:900;color:var(--text-primary);">${d.leads}</div>
        </div>
      </div>
      <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border-light);font-size:11px;color:var(--text-tertiary);">Updated ${d.lastUpdate}</div>
    </div>`).join('');

  const content = `
    <div style="max-width:900px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
        <div>
          <h1 style="font-size:22px;font-weight:900;color:var(--text-primary);margin-bottom:4px;">Research Decks</h1>
          <p style="font-size:13px;color:var(--text-secondary);">5 decks · 94 threads · 210 total leads</p>
        </div>
        <button style="padding:10px 20px;background:var(--bg-accent);color:#fff;border:none;border-radius:var(--radius-sm);font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:6px;">+ New Deck</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;">${cards}</div>
    </div>`;
  return shell('Monitoring', content);
}

function buildFolderPainMap() {
  const cols = [
    {
      label: 'Pain Points', color: '#ef4444',
      items: [
        { text: 'Per-seat pricing too expensive for growing teams',       freq: 38 },
        { text: 'Can\'t customise booking page branding',                 freq: 27 },
        { text: 'No round-robin assignment for sales teams',              freq: 21 },
        { text: 'Mobile app is broken / laggy',                           freq: 14 },
        { text: 'Stripe integration breaks with recurring appointments',  freq: 9  },
      ],
    },
    {
      label: 'Triggers', color: '#f59e0b',
      items: [
        { text: 'Calendly raised prices again in Q4 2024',   freq: 31 },
        { text: 'Free plan now limited to 1 event type',     freq: 22 },
        { text: 'Team grew past 5 people',                   freq: 17 },
        { text: 'Client complained about booking UX',        freq: 11 },
        { text: 'New hire from Cal.com background',          freq: 6  },
      ],
    },
    {
      label: 'Outcomes Sought', color: '#22c55e',
      items: [
        { text: 'Self-hosted or open-source option',                      freq: 29 },
        { text: 'Flat-fee pricing regardless of seat count',              freq: 24 },
        { text: 'Better white-label / branding support',                  freq: 18 },
        { text: 'Native Slack & CRM integrations',                        freq: 12 },
        { text: 'Two-way Google + Outlook sync',                          freq: 7  },
      ],
    },
  ];

  const colHtml = cols.map(col => `
    <div style="flex:1;min-width:0;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">
        <div style="width:8px;height:8px;border-radius:50%;background:${col.color};"></div>
        <span style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:${col.color};">${col.label}</span>
        <span style="font-size:11px;color:var(--text-tertiary);margin-left:auto;">${col.items.length} clusters</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${col.items.map(item => `
          <div style="padding:12px 14px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-md);">
            <div style="display:flex;justify-content:space-between;align-items:start;gap:10px;margin-bottom:6px;">
              <span style="font-size:13px;color:var(--text-primary);font-weight:600;line-height:1.4;">${item.text}</span>
              <span style="flex-shrink:0;font-size:11px;font-weight:800;color:${col.color};background:${col.color}15;padding:2px 7px;border-radius:99px;">${item.freq}</span>
            </div>
            <div style="height:3px;background:var(--bg-tertiary);border-radius:99px;overflow:hidden;">
              <div style="height:100%;width:${Math.round(item.freq/38*100)}%;background:${col.color};border-radius:99px;opacity:0.6;"></div>
            </div>
          </div>`).join('')}
      </div>
    </div>`).join('');

  return folderShell('Pain Map', `
    <div style="display:flex;gap:16px;flex:1;">${colHtml}</div>`);
}

function buildInboxTab() {
  const alerts = [
    { type: 'success', text: '8 new leads found in r/productivity, r/startups',              time: '2h ago' },
    { type: 'info',    text: 'No new leads in r/entrepreneur · below threshold',              time: '6h ago' },
    { type: 'success', text: '3 new leads found in r/saas, r/smallbusiness',                 time: '12h ago' },
    { type: 'success', text: '14 new leads found across 5 subreddits',                       time: '1d ago' },
    { type: 'error',   text: 'Scan error in r/remotework · retrying automatically',          time: '2d ago' },
  ];
  const alertIcons = { success: '✅', info: '🔵', error: '❌' };

  const leads = [
    { name: 'u/mkoenig_dev',     subreddits: ['productivity','startups'], score: 94, tags: ['frustration','alternative'],   threads: ['Just hit our 10th team member on Calendly — cost jumped 3x. What\'s everyone switching to?', 'We use Calendly for sales but the round-robin is so broken'], status: 'new' },
    { name: 'u/sarah_builds',    subreddits: ['saas'],                    score: 87, tags: ['alternative'],                  threads: ['Self-hosted scheduling tool that doesn\'t cost a fortune?'], status: 'new' },
    { name: 'u/thetechfounder',  subreddits: ['entrepreneur'],            score: 78, tags: ['frustration','high-engagement'], threads: ['Calendly\'s new pricing just killed our budget. Open to suggestions', '+2 more threads'], status: 'contacted' },
  ];

  const leadCards = leads.map(l => {
    const statusColor = { new: '#3b82f6', contacted: '#22c55e', ignored: '#60608a' }[l.status];
    const intentColors2 = { frustration:'#ef4444', alternative:'#f59e0b', 'high-engagement':'#3b82f6', question:'#8b5cf6' };
    return `<div style="padding:18px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-xl);margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:12px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:36px;height:36px;border-radius:50%;background:rgba(255,69,0,0.1);border:1px solid rgba(255,69,0,0.2);display:flex;align-items:center;justify-content:center;color:var(--bg-accent);font-size:14px;">👤</div>
          <div>
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-weight:700;color:var(--text-primary);">${l.name}</span>
              <span style="font-size:11px;font-weight:700;background:var(--bg-tertiary);padding:2px 7px;border-radius:99px;color:var(--text-secondary);">${l.score}% match</span>
            </div>
            <div style="display:flex;gap:6px;margin-top:3px;">${l.subreddits.map(s => `<span style="font-size:11px;font-weight:700;color:var(--bg-accent);">r/${s}</span>`).join('')}</div>
          </div>
        </div>
        <span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:99px;background:${statusColor}15;color:${statusColor};border:1px solid ${statusColor}33;">${l.status}</span>
      </div>
      <div style="padding:10px 14px;background:var(--bg-tertiary);border-radius:var(--radius-md);margin-bottom:10px;">
        ${l.threads.map(t => `<div style="font-size:12px;color:var(--text-secondary);padding:4px 0;border-bottom:1px solid var(--border-light);last-child:border:none;">› ${t}</div>`).join('')}
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div style="display:flex;gap:6px;">${l.tags.map(t => `<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:99px;background:${intentColors2[t]}15;color:${intentColors2[t]};border:1px solid ${intentColors2[t]}30;">${t}</span>`).join('')}</div>
        <div style="display:flex;gap:8px;">
          ${l.status === 'new' ? `<button style="padding:5px 12px;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.25);border-radius:var(--radius-sm);color:#22c55e;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">✓ Mark Contacted</button>` : ''}
          <button style="padding:5px 12px;background:transparent;border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-tertiary);font-size:12px;cursor:pointer;font-family:inherit;">↗ Profile</button>
        </div>
      </div>
    </div>`;
  }).join('');

  return folderShell('Inbox', `
    <div style="display:grid;grid-template-columns:1fr 340px;gap:20px;height:100%;">
      <!-- Leads -->
      <div style="overflow-y:auto;">
        <div style="font-size:13px;font-weight:700;color:var(--text-primary);margin-bottom:14px;">47 Leads <span style="color:var(--text-tertiary);font-weight:500;">· 3 new this week</span></div>
        ${leadCards}
      </div>
      <!-- Alert timeline -->
      <div>
        <div style="font-size:13px;font-weight:700;color:var(--text-primary);margin-bottom:14px;">Scan History</div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${alerts.map(a => `
            <div style="padding:12px 14px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-md);">
              <div style="display:flex;gap:8px;align-items:start;">
                <span style="font-size:14px;">${alertIcons[a.type]}</span>
                <div>
                  <div style="font-size:12px;color:var(--text-secondary);line-height:1.4;">${a.text}</div>
                  <div style="font-size:10px;color:var(--text-tertiary);margin-top:4px;">${a.time}</div>
                </div>
              </div>
            </div>`).join('')}
        </div>
      </div>
    </div>`);
}

function buildStrategyTab() {
  return folderShell('Strategy', `
    <div style="max-width:700px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <div>
          <h2 style="font-size:18px;font-weight:900;color:var(--text-primary);margin-bottom:4px;">Market Strategy Report</h2>
          <span style="font-size:12px;color:var(--text-tertiary);">Generated from 23 threads · Updated 2h ago</span>
        </div>
        <button style="padding:8px 16px;background:transparent;border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-secondary);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;">↓ Export PDF</button>
      </div>
      <!-- Report content -->
      <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-xl);padding:32px;">
        <h3 style="font-size:15px;font-weight:800;color:var(--text-primary);margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--border);">Executive Summary</h3>
        <p style="font-size:14px;color:var(--text-secondary);line-height:1.7;margin-bottom:20px;">The Calendly scheduling market shows strong dissatisfaction with per-seat pricing models. <strong style="color:var(--text-primary);">38 of 47 leads</strong> explicitly mention cost as the primary switching trigger. Users are overwhelmingly seeking flat-fee or open-source alternatives, indicating a clear gap for a product with predictable pricing and self-hosted options.</p>

        <h3 style="font-size:15px;font-weight:800;color:var(--text-primary);margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--border);">Top Opportunities</h3>
        <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:20px;">
          ${[
            { title: 'Position on flat-fee pricing', desc: 'Lead with "one price regardless of team size" — this exact phrase appears in 22 threads', score: 94 },
            { title: 'Target 5–25 person teams', desc: 'The pricing pain hits hardest at 5-10 seat threshold. These teams are actively evaluating now', score: 89 },
            { title: 'Offer self-hosted / open-source tier', desc: '29 leads mentioned self-hosting as a requirement, not a nice-to-have', score: 81 },
          ].map(op => `
            <div style="padding:14px 16px;background:var(--bg-tertiary);border:1px solid var(--border-light);border-radius:var(--radius-md);display:flex;gap:12px;align-items:start;">
              <span style="font-size:18px;font-weight:900;color:var(--bg-accent);min-width:36px;text-align:center;">${op.score}</span>
              <div>
                <div style="font-size:13px;font-weight:700;color:var(--text-primary);margin-bottom:3px;">${op.title}</div>
                <div style="font-size:12px;color:var(--text-secondary);">${op.desc}</div>
              </div>
            </div>`).join('')}
        </div>

        <h3 style="font-size:15px;font-weight:800;color:var(--text-primary);margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--border);">Messaging Recommendations</h3>
        <ul style="list-style:none;display:flex;flex-direction:column;gap:8px;">
          ${[
            '"Stop paying per seat. One price, unlimited team members."',
            '"The Calendly alternative that doesn\'t punish growth."',
            '"Self-host your booking page. Your data, your server, your price."',
          ].map(m => `<li style="padding:10px 14px;background:var(--bg-accent-alpha);border:1px solid rgba(255,69,0,0.2);border-radius:var(--radius-sm);font-size:13px;color:var(--text-primary);font-style:italic;">${m}</li>`).join('')}
        </ul>
      </div>
    </div>`);
}

function buildConfigsTab() {
  const subreddits = ['productivity', 'startups', 'entrepreneur', 'smallbusiness', 'saas', 'digitalnomad', 'remotework', 'Calendly'];
  return folderShell('Configs', `
    <div style="max-width:680px;">
      <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-xl);padding:28px;margin-bottom:16px;">
        <h3 style="font-size:14px;font-weight:800;color:var(--text-primary);margin-bottom:20px;">Monitor Settings</h3>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 0;border-bottom:1px solid var(--border-light);">
          <div>
            <div style="font-size:13px;font-weight:700;color:var(--text-primary);">Monitor Status</div>
            <div style="font-size:12px;color:var(--text-secondary);margin-top:2px;">Currently scanning all subreddits on schedule</div>
          </div>
          ${badge('Active', '#22c55e', 'rgba(34,197,94,0.1)')}
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 0;border-bottom:1px solid var(--border-light);">
          <div>
            <div style="font-size:13px;font-weight:700;color:var(--text-primary);">Scan Frequency</div>
            <div style="font-size:12px;color:var(--text-secondary);margin-top:2px;">How often new posts are checked</div>
          </div>
          <span style="font-size:13px;font-weight:600;color:var(--text-primary);">Every 4 hours</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 0;border-bottom:1px solid var(--border-light);">
          <div>
            <div style="font-size:13px;font-weight:700;color:var(--text-primary);">Relevance Threshold</div>
            <div style="font-size:12px;color:var(--text-secondary);margin-top:2px;">Minimum score to create a lead record</div>
          </div>
          <span style="font-size:13px;font-weight:600;color:var(--text-primary);">70 / 100</span>
        </div>
        <div style="padding:14px 0;">
          <div style="font-size:13px;font-weight:700;color:var(--text-primary);margin-bottom:4px;">Website Context</div>
          <div style="font-size:12px;color:var(--text-secondary);line-height:1.5;">Scheduling tool alternative for small businesses frustrated with Calendly's per-seat pricing</div>
        </div>
      </div>
      <!-- Subreddits -->
      <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-xl);padding:28px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
          <h3 style="font-size:14px;font-weight:800;color:var(--text-primary);">Monitored Subreddits</h3>
          <button style="padding:6px 14px;background:transparent;border:1px dashed var(--bg-accent);border-radius:var(--radius-sm);color:var(--bg-accent);font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">+ Add</button>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;">
          ${subreddits.map(s => `<div style="display:flex;align-items:center;gap:6px;padding:6px 12px;background:var(--bg-tertiary);border:1px solid var(--border-light);border-radius:var(--radius-sm);font-size:13px;font-weight:600;color:var(--text-primary);">r/${s} <button style="background:transparent;border:none;color:var(--text-tertiary);cursor:pointer;margin-left:2px;">×</button></div>`).join('')}
        </div>
        <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border-light);display:flex;gap:10px;">
          <button style="padding:9px 18px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);border-radius:var(--radius-sm);color:#ef4444;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">Deactivate Monitor</button>
          <button style="padding:9px 18px;background:var(--bg-accent);color:#fff;border:none;border-radius:var(--radius-sm);font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">Save Changes</button>
        </div>
      </div>
    </div>`);
}

function buildAnalysisEngine() {
  const steps = [
    { icon: '📥', title: 'Download thread', desc: 'Full post body + comments fetched up to plan depth limit', done: true },
    { icon: '🧠', title: 'Gemini 2.0 Flash analysis', desc: 'Structured extraction prompt extracts pain points, triggers, outcomes per comment', done: true },
    { icon: '🔗', title: 'Semantic clustering', desc: 'Vertex AI text-embedding-004 groups similar insights by cosine similarity', done: true },
    { icon: '✂️', title: 'LLM deduplication', desc: 'Near-identical phrases within clusters are merged into one canonical label', done: true },
    { icon: '📊', title: 'Market summary', desc: 'Cross-deck synthesis generates the Strategy tab report', done: false },
  ];

  const clusters = [
    { type: 'Pain Point', color: '#ef4444', label: 'Per-seat pricing too expensive', count: 38, sources: ['r/productivity','r/startups','r/saas'] },
    { type: 'Switch Trigger', color: '#f59e0b', label: 'Pricing changed after acquisition', count: 22, sources: ['r/entrepreneur','r/smallbusiness'] },
    { type: 'Desired Outcome', color: '#22c55e', label: 'Flat-fee pricing regardless of team size', count: 29, sources: ['r/startups','r/saas','r/remotework'] },
    { type: 'Pain Point', color: '#ef4444', label: 'No white-label / branding support', count: 17, sources: ['r/saas'] },
    { type: 'Switch Trigger', color: '#f59e0b', label: 'Team grew past free tier limit', count: 14, sources: ['r/startups','r/entrepreneur'] },
  ];

  const typeColor = { 'Pain Point': '#ef4444', 'Switch Trigger': '#f59e0b', 'Desired Outcome': '#22c55e' };

  const content = `
    <div style="max-width:860px;">
      <div style="margin-bottom:28px;">
        <h1 style="font-size:22px;font-weight:900;color:var(--text-primary);margin-bottom:6px;">Analysis Engine</h1>
        <p style="font-size:14px;color:var(--text-secondary);">How OpinionDeck extracts structured insights from Reddit threads using Vertex AI</p>
      </div>

      <!-- Pipeline diagram -->
      <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-xl);padding:24px;margin-bottom:24px;">
        <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-tertiary);margin-bottom:16px;">Analysis Pipeline</div>
        <div style="display:flex;flex-direction:column;gap:0;">
          ${steps.map((s, i) => `
          <div style="display:flex;gap:16px;align-items:start;padding:14px 0;${i < steps.length - 1 ? 'border-bottom:1px solid var(--border-light);' : ''}">
            <div style="width:36px;height:36px;border-radius:var(--radius-sm);background:${s.done ? 'rgba(34,197,94,0.1)' : 'var(--bg-tertiary)'};border:1px solid ${s.done ? 'rgba(34,197,94,0.25)' : 'var(--border-light)'};display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">${s.icon}</div>
            <div style="flex:1;">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px;">
                <span style="font-size:13px;font-weight:700;color:var(--text-primary);">${s.title}</span>
                ${s.done ? `<span style="font-size:10px;font-weight:700;color:#22c55e;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.25);padding:1px 7px;border-radius:99px;">per thread</span>` : `<span style="font-size:10px;font-weight:700;color:#f59e0b;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.25);padding:1px 7px;border-radius:99px;">per deck</span>`}
              </div>
              <div style="font-size:12px;color:var(--text-secondary);">${s.desc}</div>
            </div>
            <div style="font-size:18px;">${s.done ? '✅' : '⏳'}</div>
          </div>`).join('')}
        </div>
      </div>

      <!-- Extracted clusters -->
      <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-xl);padding:24px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-tertiary);">Sample Extracted Clusters</div>
          <span style="font-size:11px;color:var(--text-tertiary);">from 23 threads · 4,891 comments</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          ${clusters.map(c => `
          <div style="padding:14px 16px;background:var(--bg-tertiary);border:1px solid var(--border-light);border-radius:var(--radius-md);display:flex;align-items:center;gap:16px;">
            <span style="font-size:11px;font-weight:700;padding:3px 9px;border-radius:99px;background:${c.color}15;color:${c.color};border:1px solid ${c.color}33;white-space:nowrap;">${c.type}</span>
            <span style="flex:1;font-size:13px;font-weight:600;color:var(--text-primary);">${c.label}</span>
            <div style="display:flex;gap:6px;flex-shrink:0;">${c.sources.map(s => `<span style="font-size:10px;color:var(--bg-accent);font-weight:700;">r/${s.replace('r/','')}</span>`).join('')}</div>
            <span style="font-size:20px;font-weight:900;color:${c.color};min-width:32px;text-align:right;">${c.count}</span>
          </div>`).join('')}
        </div>
      </div>
    </div>`;

  return shell('Monitoring', content);
}

function buildLeadsFeed() {
  // Reuse the inbox leads section but in /leads route
  const leads = [
    { name: 'u/mkoenig_dev',     sub: 'r/productivity', score: 94, tags: ['frustration','alternative'],    thread: 'Just hit our 10th team member on Calendly — cost jumped 3x. What\'s everyone switching to?', status: 'new', time: '2h ago' },
    { name: 'u/sarah_builds',    sub: 'r/saas',          score: 87, tags: ['alternative'],                  thread: 'Self-hosted scheduling tool that doesn\'t cost a fortune?', status: 'new', time: '4h ago' },
    { name: 'u/thetechfounder',  sub: 'r/entrepreneur',  score: 78, tags: ['frustration','high-engagement'],thread: 'Calendly\'s new pricing just killed our budget — open to suggestions', status: 'contacted', time: '1d ago' },
    { name: 'u/devfounder22',    sub: 'r/startups',      score: 71, tags: ['question'],                     thread: 'Comparing Cal.com vs Calendly for a 20-person engineering org', status: 'new', time: '2d ago' },
    { name: 'u/remoteworker99',  sub: 'r/remotework',    score: 68, tags: ['frustration'],                  thread: 'Why does Calendly not support timezones properly for distributed teams?', status: 'ignored', time: '3d ago' },
  ];
  const intentColors2 = { frustration:'#ef4444', alternative:'#f59e0b', 'high-engagement':'#3b82f6', question:'#8b5cf6' };

  const cards = leads.map(l => {
    const statusColor = { new: '#3b82f6', contacted: '#22c55e', ignored: '#60608a' }[l.status];
    return `<div style="padding:18px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-xl);">
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:12px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:36px;height:36px;border-radius:50%;background:rgba(255,69,0,0.1);border:1px solid rgba(255,69,0,0.2);display:flex;align-items:center;justify-content:center;font-size:14px;">👤</div>
          <div>
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-weight:700;color:var(--text-primary);">${l.name}</span>
              <span style="font-size:11px;font-weight:700;background:var(--bg-tertiary);padding:2px 7px;border-radius:99px;color:var(--text-secondary);">${l.score}% match</span>
            </div>
            <span style="font-size:11px;font-weight:700;color:var(--bg-accent);">${l.sub}</span>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:11px;color:var(--text-tertiary);">${l.time}</span>
          <span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:99px;background:${statusColor}15;color:${statusColor};border:1px solid ${statusColor}33;">${l.status}</span>
        </div>
      </div>
      <div style="padding:10px 14px;background:var(--bg-tertiary);border-radius:var(--radius-md);margin-bottom:10px;">
        <div style="font-size:12px;color:var(--text-secondary);">› ${l.thread}</div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div style="display:flex;gap:6px;">${l.tags.map(t => `<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:99px;background:${intentColors2[t]}15;color:${intentColors2[t]};border:1px solid ${intentColors2[t]}30;">${t}</span>`).join('')}</div>
        <button style="padding:5px 12px;background:transparent;border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-tertiary);font-size:12px;cursor:pointer;font-family:inherit;">↗ View on Reddit</button>
      </div>
    </div>`;
  }).join('');

  const content = `
    <div style="max-width:780px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <div>
          <h1 style="font-size:22px;font-weight:900;color:var(--text-primary);margin-bottom:4px;">Leads</h1>
          <p style="font-size:13px;color:var(--text-secondary);">47 total · 12 new this week · across 3 monitors</p>
        </div>
        <div style="display:flex;gap:8px;">
          <select style="background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);padding:7px 12px;color:var(--text-secondary);font-size:12px;font-family:inherit;"><option>All monitors</option></select>
          <select style="background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);padding:7px 12px;color:var(--text-secondary);font-size:12px;font-family:inherit;"><option>All statuses</option></select>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;">${cards}</div>
    </div>`;
  return shell('Leads', content);
}

// ─── Folder shell (with tab bar) ───────────────────────────────────────────────

function folderShell(activeTab, bodyContent) {
  const tabs = ['Inbox','Pain Map','Strategy','Configs'];
  const tabBar = tabs.map(t => `
    <button style="padding:10px 18px;background:transparent;border:none;border-bottom:2px solid ${t === activeTab ? 'var(--bg-accent)' : 'transparent'};color:${t === activeTab ? 'var(--bg-accent)' : 'var(--text-tertiary)'};font-size:13px;font-weight:${t === activeTab ? '700' : '600'};cursor:pointer;font-family:inherit;white-space:nowrap;">${t}</button>`).join('');

  const content = `
    <div style="max-width:100%;">
      <!-- Deck header -->
      <div style="margin-bottom:4px;">
        <div style="font-size:12px;color:var(--text-tertiary);margin-bottom:6px;">Research Decks / Calendly Competitors</div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <h1 style="font-size:22px;font-weight:900;color:var(--text-primary);">Calendly Competitors</h1>
          <div style="display:flex;gap:8px;align-items:center;">
            ${badge('Monitor Active','#22c55e','rgba(34,197,94,0.1)')}
            <span style="font-size:12px;color:var(--text-tertiary);">23 threads · 47 leads</span>
          </div>
        </div>
      </div>
      <!-- Tab bar -->
      <div style="display:flex;border-bottom:1px solid var(--border);margin-bottom:20px;">${tabBar}</div>
      <!-- Content -->
      <div style="height:calc(100vh - 220px);overflow-y:auto;">${bodyContent}</div>
    </div>`;
  return shell('Monitoring', content);
}

// ─── Write + screenshot ────────────────────────────────────────────────────────

async function renderPage(browser, name, html) {
  const tmpFile = path.join(TMP_DIR, `${name}.html`);
  fs.writeFileSync(tmpFile, html, 'utf8');
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(`file://${tmpFile}`, { waitUntil: 'networkidle0', timeout: 20000 });
  // Wait for fonts
  await new Promise(r => setTimeout(r, 1200));
  const outFile = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: outFile, type: 'png' });
  await page.close();
  console.log(`  ✓ ${name}.png`);
}

(async () => {
  console.log('\n📸 Building mockup screenshots…\n');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const pages = [
      ['signup-form',          buildSignup()],
      ['dashboard-overview',   buildDashboard()],
      ['discovery-search',     buildDiscoverySearch()],
      ['discovery-results',    buildDiscoveryResults()],
      ['monitoring-dashboard', buildMonitoringCreate()],
      ['folders-view',         buildFoldersList()],
      ['pain-map',             buildFolderPainMap()],
      ['inbox-tab',            buildInboxTab()],
      ['strategy-tab',         buildStrategyTab()],
      ['configs-tab',          buildConfigsTab()],
      ['leads-feed',           buildLeadsFeed()],
      ['analysis-engine',      buildAnalysisEngine()],
    ];

    for (const [name, html] of pages) {
      await renderPage(browser, name, html);
    }
  } finally {
    await browser.close();
    // Clean up tmp
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
    console.log(`\n✅ Done — screenshots in: ${OUT_DIR}\n`);
  }
})();
