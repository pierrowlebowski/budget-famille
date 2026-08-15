const CACHE_KEY = 'budget_famille_v2';
const QUEUE_KEY = 'budget_famille_queue_v1';
const TABLE     = 'virements';

let data  = [];
let queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');

/* ---- Accès Supabase ---- */

function isConfigured() {
  return SUPABASE_URL.startsWith('http') && !SUPABASE_URL.includes('VOTRE');
}

function sbUrl(path) {
  return `${SUPABASE_URL}/rest/v1/${path}`;
}

function sbHeaders(extra) {
  return Object.assign({
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json'
  }, extra || {});
}

/* ---- Persistance locale (cache + file d'attente hors ligne) ---- */

function writeCache() { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); }
function writeQueue() { localStorage.setItem(QUEUE_KEY, JSON.stringify(queue)); }

// Rejoue les opérations pas encore envoyées par-dessus l'état du serveur,
// pour qu'un ajout fait hors ligne ne disparaisse pas de l'écran.
function applyQueue(rows) {
  let out = rows.slice();
  queue.forEach(op => {
    if (op.type === 'insert' && !out.some(t => t.id === op.row.id)) out.push(op.row);
    if (op.type === 'delete') out = out.filter(t => t.id !== op.id);
  });
  return out;
}

/* ---- Synchronisation ---- */

function setStatus(state, text) {
  const el = document.getElementById('syncStatus');
  el.className = 'sync sync-' + state;
  el.textContent = text;
}

async function flushQueue() {
  if (!isConfigured() || !queue.length) return;
  setStatus('sync', 'Envoi…');

  while (queue.length) {
    const op = queue[0];
    try {
      const res = op.type === 'insert'
        // merge-duplicates rend le renvoi idempotent si la ligne est déjà passée
        ? await fetch(sbUrl(TABLE), {
            method: 'POST',
            headers: sbHeaders({ Prefer: 'resolution=merge-duplicates' }),
            body: JSON.stringify(op.row)
          })
        : await fetch(sbUrl(`${TABLE}?id=eq.${encodeURIComponent(op.id)}`), {
            method: 'DELETE',
            headers: sbHeaders()
          });
      if (!res.ok) throw new Error(await res.text());
      queue.shift();
      writeQueue();
    } catch (e) {
      console.warn('Supabase : envoi impossible', e);
      setStatus('off', `${queue.length} en attente`);
      return;
    }
  }
}

async function pull() {
  if (!isConfigured()) { setStatus('off', 'Non configuré'); return; }
  setStatus('sync', 'Synchro…');

  try {
    const res = await fetch(
      sbUrl(`${TABLE}?select=id,person,amount,date,note&order=date.desc`),
      { headers: sbHeaders(), cache: 'no-store' }
    );
    if (!res.ok) throw new Error(await res.text());

    const rows = await res.json();
    data = applyQueue(rows.map(r => ({
      id: r.id, person: r.person, amount: Number(r.amount), date: r.date, note: r.note || ''
    })));
    writeCache();
    render();
    setStatus(queue.length ? 'off' : 'ok', queue.length ? `${queue.length} en attente` : 'À jour');
  } catch (e) {
    console.warn('Supabase : lecture impossible', e);
    setStatus('off', queue.length ? `${queue.length} en attente` : 'Hors ligne');
  }
}

async function sync() {
  await flushQueue();
  await pull();
}

async function loadData() {
  // Affiche immédiatement le cache, puis rafraîchit depuis le serveur.
  data = JSON.parse(localStorage.getItem(CACHE_KEY) || '[]');
  render();
  await sync();
}

/* ---- Helpers ---- */

function today() {
  return new Date().toISOString().slice(0, 10);
}

function fmt(n) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function fmtDate(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

function avgLast6Months(person) {
  const now = new Date();
  const cutoff = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const relevant = data.filter(t => t.person === person && new Date(t.date) >= cutoff);
  const total = relevant.reduce((s, t) => s + t.amount, 0);
  const months = (now.getFullYear() - cutoff.getFullYear()) * 12 + (now.getMonth() - cutoff.getMonth()) + 1;
  return total / Math.max(months, 1);
}

function avgCumulative(person) {
  if (!data.length) return 0;
  const relevant = data.filter(t => t.person === person);
  const total = relevant.reduce((s, t) => s + t.amount, 0);
  const allDates = data.map(t => new Date(t.date));
  const first = new Date(Math.min(...allDates));
  const now = new Date();
  const months = (now.getFullYear() - first.getFullYear()) * 12 + (now.getMonth() - first.getMonth()) + 1;
  return total / Math.max(months, 1);
}

function exportJSON() {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'budget-famille.json';
  a.click();
  URL.revokeObjectURL(url);
}

function exportExcel() {
  const rows = [...data]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(t => ({
      Date: fmtDate(t.date),
      Montant: t.amount,
      Qui: t.person,
      Note: t.note || ''
    }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [{ wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 30 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Virements');
  XLSX.writeFile(wb, 'budget-famille.xlsx');
}

/* ---- Render ---- */

function render() {
  const totals = { 'Léa': 0, 'Pierre': 0 };
  data.forEach(t => { totals[t.person] = (totals[t.person] || 0) + t.amount; });

  const avgLea = avgLast6Months('Léa');
  const avgPierre = avgLast6Months('Pierre');

  document.getElementById('balanceGrid').innerHTML = ['Léa', 'Pierre'].map(p => {
    const isLea = p === 'Léa';
    const avg6 = isLea ? avgLea : avgPierre;
    const avgAll = avgCumulative(p);
    const cls = isLea ? 'lea' : 'pierre';
    return `
      <div class="balance-card">
        <div class="avatar ${cls}-avatar">${p.slice(0, 2).toUpperCase()}</div>
        <div class="name">${p}</div>
        <div class="total">${fmt(totals[p] || 0)}</div>
        <div class="avg">Moy. 6 mois : ${fmt(avg6)}/mois</div>
        <div class="avg">Moy. cumulée : ${fmt(avgAll)}/mois</div>
      </div>`;
  }).join('');

  const tLea = totals['Léa'] || 0;
  const tPierre = totals['Pierre'] || 0;
  const total = tLea + tPierre;
  const leaPct = total > 0 ? (tLea / total * 100) : 50;

  document.getElementById('diffBar').style.width = leaPct.toFixed(1) + '%';
  document.getElementById('diffLabelLea').textContent = `Léa ${leaPct.toFixed(0)}%`;
  document.getElementById('diffLabelPierre').textContent = `${(100 - leaPct).toFixed(0)}% Pierre`;

  const diff = Math.abs(tLea - tPierre);
  let statusHtml = '';
  if (total === 0) {
    statusHtml = 'Aucun virement enregistré.';
  } else if (diff < 0.01) {
    statusHtml = '✓ Parfaitement équilibré !';
  } else {
    const ahead = tLea > tPierre ? 'Léa' : 'Pierre';
    statusHtml = `<strong>${ahead}</strong> a versé <strong>${fmt(diff)}</strong> de plus`;
  }
  document.getElementById('diffStatus').innerHTML = statusHtml;

  const listEl = document.getElementById('txList');
  const sorted = [...data].sort((a, b) => b.date.localeCompare(a.date));

  if (!sorted.length) {
    listEl.innerHTML = '<div class="empty">Aucun virement pour l\'instant.</div>';
    return;
  }

  listEl.innerHTML = sorted.map(t => {
    const isLea = t.person === 'Léa';
    const cls = isLea ? 'lea' : 'pierre';
    return `
      <div class="tx-item">
        <div class="tx-av ${cls}-avatar">${t.person.slice(0, 2).toUpperCase()}</div>
        <div class="tx-info">
          <div class="tx-name">${t.person}</div>
          ${t.note ? `<div class="tx-note">${t.note}</div>` : ''}
        </div>
        <div class="tx-right">
          <span class="tx-date">${fmtDate(t.date)}</span>
          <span class="tx-amount">+${fmt(t.amount)}</span>
          <button class="tx-del" onclick="delTx('${t.id}')" title="Supprimer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
            </svg>
          </button>
        </div>
      </div>`;
  }).join('');
}

/* ---- Actions ---- */

function addTx() {
  const person = document.getElementById('inPerson').value;
  const amount = parseFloat(document.getElementById('inAmount').value);
  const date   = document.getElementById('inDate').value || today();
  const note   = document.getElementById('inNote').value.trim();

  if (!amount || amount <= 0) { document.getElementById('inAmount').focus(); return; }

  // id unique même si deux appareils saisissent à la même seconde
  const row = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), person, amount, date, note };
  data.push(row);
  queue.push({ type: 'insert', row });
  writeCache();
  writeQueue();

  document.getElementById('inAmount').value = '';
  document.getElementById('inNote').value   = '';
  render();
  sync();
}

function delTx(id) {
  if (!confirm('Supprimer ce virement ?')) return;
  data = data.filter(t => t.id !== id);
  queue.push({ type: 'delete', id });
  writeCache();
  writeQueue();
  render();
  sync();
}

/* ---- Init ---- */

document.getElementById('inDate').value = today();
document.getElementById('inAmount').addEventListener('keydown', e => { if (e.key === 'Enter') addTx(); });
document.getElementById('inNote').addEventListener('keydown', e => { if (e.key === 'Enter') addTx(); });

// Récupère les saisies faites depuis l'autre appareil
document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(); });
window.addEventListener('online', sync);
setInterval(() => { if (!document.hidden) sync(); }, 60000);

loadData();
