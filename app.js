'use strict';

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n)    { return Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 }); }
function fmtInt(n) { return Math.round(n).toLocaleString(); }

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showError(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  if (msg) setTimeout(() => { if (el.textContent === msg) el.textContent = ''; }, 5000);
}

function getAmount() {
  const val = parseInt(document.getElementById('amountInput').value, 10);
  if (isNaN(val) || val <= 0) { showError('errorMsg', 'Please enter a positive integer amount.'); return null; }
  return val;
}

function getNote() { return document.getElementById('noteInput').value.trim(); }

function clearInputs() {
  document.getElementById('amountInput').value = '';
  document.getElementById('noteInput').value   = '';
}

// ── API ───────────────────────────────────────────────────────────────────────
async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res  = await fetch(path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ── Render tracker ────────────────────────────────────────────────────────────
function render(state, history) {
  const balEl = document.getElementById('balanceDisplay');
  balEl.textContent = fmtInt(state.balance);
  balEl.className   = 'balance-value';
  if (state.budget) {
    const pct = state.balance / state.budget;
    balEl.classList.add(pct <= 0.2 ? 'low' : pct <= 0.5 ? 'mid' : 'good');
  } else {
    balEl.classList.add('good');
  }

  document.getElementById('totalAdded').textContent = fmtInt(state.added);
  document.getElementById('totalSpent').textContent = fmtInt(state.spent);
  document.getElementById('txCount').textContent    = fmtInt(history.length);

  const wrap = document.getElementById('progressWrap');
  if (state.budget) {
    wrap.style.display = 'block';
    const usedPct = Math.min(100, Math.round(((state.budget - state.balance) / state.budget) * 100));
    document.getElementById('progressLabel').textContent =
      `Budget: ${fmtInt(state.budget - state.balance)} spent of ${fmtInt(state.budget)}`;
    document.getElementById('progressPct').textContent = `${usedPct}% used`;
    const fill = document.getElementById('progressFill');
    fill.style.width      = usedPct + '%';
    fill.style.background = usedPct >= 90 ? '#cf222e' : usedPct >= 60 ? '#bf8700' : '#1a7f37';
    document.getElementById('budgetInfo').textContent = `Budget cap: ${fmtInt(state.budget)} tokens`;
  } else {
    wrap.style.display = 'none';
  }

  const list = document.getElementById('historyList');
  if (!history.length) {
    list.innerHTML = '<li class="history-empty">No transactions yet.</li>';
    return;
  }
  list.innerHTML = history.map(e => {
    let badgeClass, amtClass, amtStr, badgeLabel;
    if (e.type === 'add') {
      badgeClass = 'badge-add';   amtClass = 'positive'; amtStr = `+${fmt(e.amount)}`; badgeLabel = 'Add';
    } else if (e.type === 'spend') {
      badgeClass = 'badge-spend'; amtClass = 'negative'; amtStr = `−${fmt(e.amount)}`; badgeLabel = 'Spend';
    } else {
      badgeClass = 'badge-reset'; amtClass = 'neutral';  amtStr = '0';                 badgeLabel = 'Reset';
    }
    const desc = e.note || (e.type === 'add' ? 'Tokens added' : e.type === 'spend' ? 'Tokens spent' : 'Balance reset');
    return `<li>
      <span class="badge ${badgeClass}">${badgeLabel}</span>
      <span class="history-desc">${escHtml(desc)}</span>
      <span class="history-amount ${amtClass}">${amtStr}</span>
      <span class="history-balance">Bal: ${fmt(e.balance)}</span>
      <span class="history-time">${e.created}</span>
    </li>`;
  }).join('');
}

async function refresh() {
  const { state, history } = await api('GET', '/api/state');
  render(state, history);
}

// ── Tracker events ────────────────────────────────────────────────────────────
document.getElementById('btnAdd').addEventListener('click', async () => {
  const amount = getAmount(); if (!amount) return;
  try { await api('POST', '/api/add', { amount, note: getNote() }); clearInputs(); showError('errorMsg', ''); await refresh(); }
  catch (e) { showError('errorMsg', e.message); }
});

document.getElementById('btnSpend').addEventListener('click', async () => {
  const amount = getAmount(); if (!amount) return;
  try { await api('POST', '/api/spend', { amount, note: getNote() }); clearInputs(); showError('errorMsg', ''); await refresh(); }
  catch (e) { showError('errorMsg', e.message); }
});

document.getElementById('btnReset').addEventListener('click', async () => {
  try { await api('POST', '/api/reset', { note: getNote() || 'Manual reset' }); clearInputs(); showError('errorMsg', ''); await refresh(); }
  catch (e) { showError('errorMsg', e.message); }
});

document.getElementById('btnSetBudget').addEventListener('click', async () => {
  const budget = parseInt(document.getElementById('budgetInput').value, 10);
  if (isNaN(budget) || budget <= 0) { showError('errorMsg', 'Enter a positive number for the budget cap.'); return; }
  try { await api('POST', '/api/budget', { budget }); document.getElementById('budgetInput').value = ''; showError('errorMsg', ''); await refresh(); }
  catch (e) { showError('errorMsg', e.message); }
});

document.getElementById('btnClearHistory').addEventListener('click', async () => {
  try { await api('DELETE', '/api/history'); await refresh(); }
  catch (e) { showError('errorMsg', e.message); }
});

document.getElementById('amountInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btnAdd').click();
});

// ── Task Types tab ────────────────────────────────────────────────────────────
function renderTaskTypes(types) {
  document.getElementById('ttCount').textContent = `${types.length} type${types.length !== 1 ? 's' : ''}`;
  const tbody = document.getElementById('taskTypeBody');
  if (!types.length) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:24px;color:#57606a;">No task types configured.</td></tr>';
    return;
  }
  tbody.innerHTML = types.map(t => `
    <tr data-id="${t.id}">
      <td>${escHtml(t.name)}</td>
      <td class="tt-tokens-cell">${fmt(t.tokens)}</td>
      <td><button class="btn-edit tt-edit-btn" data-id="${t.id}" data-tokens="${t.tokens}">Edit</button></td>
      <td><button class="btn-delete tt-del-btn" data-id="${t.id}">Delete</button></td>
    </tr>`).join('');

  tbody.querySelectorAll('.tt-del-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      try { renderTaskTypes(await api('DELETE', `/api/task-types/${btn.dataset.id}`)); }
      catch (e) { showError('ttError', e.message); }
    });
  });

  tbody.querySelectorAll('.tt-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id   = btn.dataset.id;
      const row  = btn.closest('tr');
      const cell = row.querySelector('.tt-tokens-cell');
      cell.innerHTML = `<input class="tt-edit-input" type="number" min="0.1" step="0.1" value="${escHtml(btn.dataset.tokens)}" />`;
      btn.textContent = 'Save';
      btn.classList.replace('btn-edit', 'btn-budget');
      const newBtn = btn.cloneNode(true);          // remove old listener
      btn.replaceWith(newBtn);
      newBtn.addEventListener('click', async () => {
        const val = parseFloat(cell.querySelector('input').value);
        if (isNaN(val) || val <= 0) { showError('ttError', 'Tokens must be a positive number.'); return; }
        try { renderTaskTypes(await api('PUT', `/api/task-types/${id}`, { tokens: val })); }
        catch (e) { showError('ttError', e.message); }
      });
    });
  });
}

async function loadTaskTypes() {
  renderTaskTypes(await api('GET', '/api/task-types'));
}

document.getElementById('btnAddType').addEventListener('click', async () => {
  const name   = document.getElementById('ttName').value.trim();
  const tokens = parseFloat(document.getElementById('ttTokens').value);
  if (!name)               { showError('ttError', 'Type name is required.'); return; }
  if (isNaN(tokens) || tokens <= 0) { showError('ttError', 'Tokens must be a positive number.'); return; }
  try {
    renderTaskTypes(await api('POST', '/api/task-types', { name, tokens }));
    document.getElementById('ttName').value = '';
    document.getElementById('ttTokens').value = '';
    showError('ttError', '');
  } catch (e) { showError('ttError', e.message); }
});

// ── File Calculator ───────────────────────────────────────────────────────────
let lastCalcResult = null;

// Detect delimiter: tab-separated or comma-separated
function detectDelimiter(firstLine) {
  const tabs   = (firstLine.match(/\t/g)   || []).length;
  const commas = (firstLine.match(/,/g)    || []).length;
  return tabs >= commas ? '\t' : ',';
}

// Parse a delimited text file into array-of-objects
function parseDelimited(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error('File must have a header row and at least one data row.');
  const delim   = detectDelimiter(lines[0]);
  const headers = splitLine(lines[0], delim).map(h => h.trim());
  return lines.slice(1)
    .filter(l => l.trim().length > 0)
    .map(line => {
      const vals = splitLine(line, delim);
      const obj  = {};
      headers.forEach((h, i) => { obj[h] = (vals[i] || '').trim(); });
      return obj;
    });
}

// Split a single line respecting quoted fields (for CSV)
function splitLine(line, delim) {
  if (delim === '\t') return line.split('\t');
  const vals = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') { inQ = !inQ; continue; }
    if (line[i] === delim && !inQ) { vals.push(cur); cur = ''; continue; }
    cur += line[i];
  }
  vals.push(cur);
  return vals;
}

document.getElementById('fileInput').addEventListener('change', () => {
  const f = document.getElementById('fileInput').files[0];
  document.getElementById('fileLabel').textContent = f ? f.name : 'Choose CSV or TSV file…';
  document.getElementById('calcResult').classList.add('hidden');
  lastCalcResult = null;
});

document.getElementById('btnCalculate').addEventListener('click', async () => {
  const fileInput = document.getElementById('fileInput');
  if (!fileInput.files.length) { showError('calcError', 'Please choose a file first.'); return; }
  const file = fileInput.files[0];
  let rows;
  try {
    rows = parseDelimited(await file.text());
  } catch (e) {
    showError('calcError', 'Could not parse file: ' + e.message);
    return;
  }
  if (!rows.length) { showError('calcError', 'File has no data rows.'); return; }

  try {
    const result = await api('POST', '/api/calculate', { rows });
    lastCalcResult = result;
    renderCalcResult(result);
    showError('calcError', '');
  } catch (e) { showError('calcError', e.message); }
});

function renderCalcResult(result) {
  document.getElementById('calcTotal').textContent       = fmt(result.grandTotal);
  document.getElementById('calcClaimed').textContent     = fmt(result.fileClaimedTotal);
  document.getElementById('calcTicketCount').textContent = result.results.length;
  document.getElementById('calcRowCount').textContent    = `${result.results.length} ticket${result.results.length !== 1 ? 's' : ''}`;

  // Warn if any unknown types
  const unknownCols = new Set();
  result.results.forEach(r => r.taskBreakdown.filter(t => !t.known).forEach(t => unknownCols.add(t.column)));
  if (unknownCols.size) {
    document.getElementById('calcWarn').textContent =
      `Columns with no matching task type (counted as 0): ${[...unknownCols].map(c => `"${c}"`).join(', ')}. Add them in the Task Types tab.`;
  } else {
    document.getElementById('calcWarn').textContent = '';
  }

  // Accordion — one card per ticket
  const accordion = document.getElementById('ticketAccordion');
  accordion.innerHTML = result.results.map((r, i) => {
    const diff     = Math.round((r.computed - r.fileClaimed) * 100) / 100;
    const diffTxt  = diff === 0 ? 'Match' : diff > 0 ? `+${fmt(diff)} vs claimed` : `${fmt(diff)} vs claimed`;
    const diffCls  = diff === 0 ? 'neutral' : diff > 0 ? 'positive' : 'negative';
    const tasksHtml = r.taskBreakdown.map(t => `
      <tr class="${t.known ? '' : 'unknown'}">
        <td>${escHtml(t.column)}</td>
        <td style="text-align:center;">${t.qty}</td>
        <td style="text-align:center;">${t.known ? fmt(t.costPerUnit) : '<span style="color:#cf222e">?</span>'}</td>
        <td style="text-align:right;font-weight:600;">${t.known ? fmt(t.tokens) : '0'}</td>
      </tr>`).join('');

    return `
    <div class="accordion-item">
      <button class="accordion-header" data-idx="${i}">
        <span class="acc-ticket">${escHtml(r.ticketId)}</span>
        <span class="acc-desc muted">${escHtml(r.description.slice(0, 60))}${r.description.length > 60 ? '…' : ''}</span>
        <span class="acc-meta">
          <span class="badge badge-market">${escHtml(r.market)}</span>
          <span class="badge badge-status">${escHtml(r.status)}</span>
        </span>
        <span class="acc-tokens">${fmt(r.computed)} tokens</span>
        <span class="history-amount ${diffCls}" style="font-size:11px;min-width:100px;text-align:right;">${diffTxt}</span>
        <span class="acc-chevron">▶</span>
      </button>
      <div class="accordion-body hidden" id="acc-body-${i}">
        <table class="breakdown-table">
          <thead><tr><th>Task Type</th><th style="text-align:center;">Qty</th><th style="text-align:center;">Cost/Unit</th><th style="text-align:right;">Tokens</th></tr></thead>
          <tbody>${tasksHtml || '<tr><td colspan="4" style="text-align:center;color:#57606a;padding:12px;">No task columns with a non-zero value.</td></tr>'}</tbody>
          <tfoot><tr>
            <td colspan="3" style="text-align:right;font-weight:700;padding:10px 24px;font-size:13px;border-top:2px solid #e5e7eb;">Total</td>
            <td style="text-align:right;font-weight:700;padding:10px 24px;font-size:14px;border-top:2px solid #e5e7eb;">${fmt(r.computed)}</td>
          </tr></tfoot>
        </table>
      </div>
    </div>`;
  }).join('');

  // Wire accordion toggles
  accordion.querySelectorAll('.accordion-header').forEach(btn => {
    btn.addEventListener('click', () => {
      const body    = document.getElementById(`acc-body-${btn.dataset.idx}`);
      const chevron = btn.querySelector('.acc-chevron');
      const open    = !body.classList.contains('hidden');
      body.classList.toggle('hidden', open);
      chevron.textContent = open ? '▶' : '▼';
    });
  });

  document.getElementById('calcResult').classList.remove('hidden');
}

document.getElementById('btnPushAdd').addEventListener('click', async () => {
  if (!lastCalcResult || lastCalcResult.grandTotal <= 0) {
    showError('calcError', 'Calculated total is 0 — nothing to add.'); return;
  }
  try {
    const fname = document.getElementById('fileInput').files[0]?.name || 'file';
    await api('POST', '/api/add', { amount: Math.round(lastCalcResult.grandTotal), note: `From file: ${fname}` });
    showError('calcError', ''); await refresh();
    flashBtn('btnPushAdd', '+ Add to Balance', 'Added!');
  } catch (e) { showError('calcError', e.message); }
});

document.getElementById('btnPushSpend').addEventListener('click', async () => {
  if (!lastCalcResult || lastCalcResult.grandTotal <= 0) {
    showError('calcError', 'Calculated total is 0 — nothing to spend.'); return;
  }
  try {
    const fname = document.getElementById('fileInput').files[0]?.name || 'file';
    await api('POST', '/api/spend', { amount: Math.round(lastCalcResult.grandTotal), note: `From file: ${fname}` });
    showError('calcError', ''); await refresh();
    flashBtn('btnPushSpend', '− Spend from Balance', 'Spent!');
  } catch (e) { showError('calcError', e.message); }
});

function flashBtn(id, original, flash) {
  const btn = document.getElementById(id);
  btn.textContent = flash;
  setTimeout(() => { btn.textContent = original; }, 1800);
}

// ── Sample downloads ──────────────────────────────────────────────────────────
document.getElementById('btnSampleCsv').addEventListener('click', () => {
  const header = 'Ticket ID,Project URL,Business Line,RRP Product,Ticket Description,Market,Status,Total No. of Tokens,New journey- simple,New journey- medium,New journey- complex,Emails,Email Amendment,Journey amendment - simple,Journey amendment - complex,Testing,Deployment,Weekend Hours?';
  const row1   = '4050001,https://example.com,RRP,P1 IQOS,Build welcome journey,Indonesia,Complete,40,1,0,0,2,1,1,0,0,0,No';
  const row2   = '4050002,https://example.com,RRP,P1 IQOS,Amend promo email,Philippines,In Progress,20,0,0,0,0,3,0,1,0,0,No';
  downloadFile('sample_tasks.csv', 'text/csv', [header, row1, row2].join('\n'));
});

document.getElementById('btnSampleTsv').addEventListener('click', () => {
  const cols = ['Ticket ID','Project URL','Business Line','RRP Product','Ticket Description','Market','Status','Total No. of Tokens','New journey- simple','New journey- medium','New journey- complex','Emails','Email Amendment','Journey amendment - simple','Journey amendment - complex','Weekend Hours?'];
  const r1   = ['4050001','https://example.com','RRP','P1 IQOS','Build welcome journey','Indonesia','Complete','40','1','0','0','2','1','1','0','No'];
  const r2   = ['4050002','https://example.com','RRP','P1 IQOS','Amend promo email','Philippines','In Progress','20','0','0','0','0','3','0','1','No'];
  downloadFile('sample_tasks.tsv', 'text/tab-separated-values', [cols, r1, r2].map(r => r.join('\t')).join('\n'));
});

function downloadFile(name, mime, content) {
  const a    = document.createElement('a');
  a.href     = `data:${mime};charset=utf-8,${encodeURIComponent(content)}`;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ── Tab switching ─────────────────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.remove('hidden');
    if (btn.dataset.tab === 'tasktypes') loadTaskTypes();
  });
});

// ── Init ──────────────────────────────────────────────────────────────────────
refresh();
