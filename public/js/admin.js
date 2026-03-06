let players = [];
let csvPlayers = [];

// Check if already logged in
async function checkSession() {
  const res = await fetch('/api/admin/check');
  const data = await res.json();
  if (data.isAdmin) showAdminPanel();
}

async function doLogin() {
  const username = document.getElementById('loginUsername').value;
  const password = document.getElementById('loginPassword').value;
  const res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();
  if (data.success) showAdminPanel();
  else showToast(data.error || 'Login failed', 'error');
}

async function logout() {
  await fetch('/api/admin/logout', { method: 'POST' });
  document.getElementById('adminPanel').style.display = 'none';
  document.getElementById('loginPanel').style.display = 'block';
  document.getElementById('logoutBtn').style.display = 'none';
}

function showAdminPanel() {
  document.getElementById('loginPanel').style.display = 'none';
  document.getElementById('adminPanel').style.display = 'block';
  document.getElementById('logoutBtn').style.display = 'inline-flex';
  loadPlayers();
}

function showTab(tab) {
  document.getElementById('tabPlayers').style.display = tab === 'players' ? 'block' : 'none';
  document.getElementById('tabBulk').style.display = tab === 'bulk' ? 'block' : 'none';
}

async function loadPlayers() {
  const res = await fetch('/api/players');
  players = await res.json();
  renderTable();
}

function renderTable() {
  const tbody = document.getElementById('adminTableBody');
  if (!players.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:var(--muted);">No players yet. Add one!</td></tr>';
    return;
  }
  tbody.innerHTML = players.map(p => `
    <tr>
      <td style="color:var(--muted)">${p.id}</td>
      <td><strong>${p.name}</strong></td>
      <td><span class="badge badge-role">${p.role}</span></td>
      <td>₹${Number(p.base_price).toLocaleString('en-IN')}</td>
      <td style="color:var(--gold); font-family:'Teko',sans-serif; font-size:1.2rem;">₹${Number(p.current_bid).toLocaleString('en-IN')}</td>
      <td style="color:var(--teal)">${p.current_bidder || '-'} ${p.team ? '/ ' + p.team : ''}</td>
      <td><span class="badge" style="background:${p.status === 'sold' ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)'}; color:${p.status === 'sold' ? 'var(--red)' : 'var(--green)'}; border:1px solid ${p.status === 'sold' ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}">${p.status.toUpperCase()}</span></td>
      <td>
        <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
          <button class="btn btn-outline btn-sm" onclick="openEditModal(${p.id})">Edit</button>
          <button class="btn btn-success btn-sm" onclick="resetBids(${p.id})">Reset</button>
          ${p.status !== 'sold' ? `<button class="btn btn-sm" style="background:var(--teal);color:var(--navy)" onclick="sellPlayer(${p.id})">Sell</button>` : ''}
          <button class="btn btn-danger btn-sm" onclick="deletePlayer(${p.id})">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');
}

// ── BULK IMPORT ──────────────────────────────────────────

function downloadSampleCSV() {
  const sample = `name,role,nationality,age,base_price,image_url,stats
Shubman Gill,Batsman,Indian,24,14000000,https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Shubman_Gill.jpg/440px-Shubman_Gill.jpg,"{""matches"":91,""runs"":3221,""average"":46.7,""strike_rate"":148.2}"
Mohammed Siraj,Bowler,Indian,30,10000000,,"{""matches"":93,""wickets"":98,""economy"":8.4,""average"":26.1}"
Shreyas Iyer,Batsman,Indian,29,12000000,,"{""matches"":115,""runs"":3188,""average"":34.3,""strike_rate"":126.5}"
Rishabh Pant,Wicket-Keeper,Indian,26,16000000,,"{""matches"":111,""runs"":3284,""average"":35.6,""strike_rate"":148.9}"
Axar Patel,All-Rounder,Indian,30,11000000,,"{""matches"":115,""runs"":1374,""wickets"":97,""economy"":7.2}"`;

  const blob = new Blob([sample], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'ipl_players_sample.csv';
  a.click();
}

function handleFile(input) {
  const file = input.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      csvPlayers = parseCSV(e.target.result);
      showPreview();
    } catch (err) {
      showToast('Error reading CSV: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
}

function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) throw new Error('CSV must have a header row and at least one player');

  const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
  const required = ['name', 'role', 'nationality', 'base_price'];
  for (const r of required) {
    if (!headers.includes(r)) throw new Error(`Missing required column: "${r}"`);
  }

  const players = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = parseCSVLine(lines[i]);
    const player = {};
    headers.forEach((h, idx) => { player[h] = values[idx] ? values[idx].trim() : ''; });
    players.push(player);
  }
  return players;
}

// Handles quoted fields with commas inside
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function showPreview() {
  document.getElementById('csvPreview').style.display = 'block';
  document.getElementById('csvCount').textContent = `${csvPlayers.length} players found in CSV`;

  const tbody = document.getElementById('previewBody');
  tbody.innerHTML = csvPlayers.map(p => `
    <tr>
      <td>${p.name}</td>
      <td><span class="badge badge-role">${p.role}</span></td>
      <td>${p.nationality}</td>
      <td>${p.age || '-'}</td>
      <td style="color:var(--gold)">₹${Number(p.base_price).toLocaleString('en-IN')}</td>
      <td style="color:var(--muted); font-size:0.8rem; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${p.image_url || '-'}</td>
    </tr>
  `).join('');
}

async function importPlayers() {
  if (!csvPlayers.length) return;

  const btn = event.target;
  btn.textContent = 'Importing...';
  btn.disabled = true;

  const res = await fetch('/api/admin/players/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ players: csvPlayers })
  });

  const data = await res.json();
  btn.textContent = '✅ Import All Players';
  btn.disabled = false;

  const resultsEl = document.getElementById('importResults');
  resultsEl.style.display = 'block';
  resultsEl.innerHTML = `
    <div style="background:var(--card); border:1px solid var(--border); border-radius:12px; padding:1.5rem;">
      <h3 style="font-family:'Teko',sans-serif; font-size:1.3rem; color:var(--gold); margin-bottom:1rem;">IMPORT RESULTS</h3>
      <p style="color:var(--green); margin-bottom:0.5rem;">✅ Successfully imported: <strong>${data.success}</strong> players</p>
      ${data.failed > 0 ? `<p style="color:var(--red); margin-bottom:0.5rem;">❌ Failed: <strong>${data.failed}</strong> players</p>` : ''}
      ${data.errors.length ? `
        <div style="margin-top:1rem;">
          <p style="color:var(--muted); margin-bottom:0.5rem;">Errors:</p>
          ${data.errors.map(e => `<p style="color:var(--red); font-size:0.85rem;">• ${e}</p>`).join('')}
        </div>` : ''}
      <button class="btn btn-gold" style="margin-top:1rem;" onclick="showTab('players'); loadPlayers();">View Players →</button>
    </div>`;

  clearCSV();
  if (data.success > 0) showToast(`${data.success} players imported successfully!`);
}

function clearCSV() {
  csvPlayers = [];
  document.getElementById('csvFile').value = '';
  document.getElementById('csvPreview').style.display = 'none';
}

// ── SINGLE PLAYER MODAL ──────────────────────────────────

function openAddModal() {
  document.getElementById('playerModalTitle').textContent = 'ADD PLAYER';
  document.getElementById('editPlayerId').value = '';
  document.getElementById('editStatusGroup').style.display = 'none';
  ['pName','pNationality','pAge','pBasePrice','pImageUrl','pStats'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('pRole').value = 'Batsman';
  document.getElementById('playerModal').classList.add('active');
}

function openEditModal(id) {
  const p = players.find(x => x.id === id);
  if (!p) return;
  document.getElementById('playerModalTitle').textContent = 'EDIT PLAYER';
  document.getElementById('editPlayerId').value = id;
  document.getElementById('pName').value = p.name;
  document.getElementById('pRole').value = p.role;
  document.getElementById('pNationality').value = p.nationality;
  document.getElementById('pAge').value = p.age || '';
  document.getElementById('pBasePrice').value = p.base_price;
  document.getElementById('pImageUrl').value = p.image_url || '';
  document.getElementById('pStats').value = p.stats ? JSON.stringify(p.stats, null, 2) : '';
  document.getElementById('pStatus').value = p.status;
  document.getElementById('editStatusGroup').style.display = 'block';
  document.getElementById('playerModal').classList.add('active');
}

function closePlayerModal() {
  document.getElementById('playerModal').classList.remove('active');
}

async function savePlayer() {
  const editId = document.getElementById('editPlayerId').value;
  const statsRaw = document.getElementById('pStats').value.trim();
  let stats = null;
  if (statsRaw) {
    try { stats = JSON.parse(statsRaw); }
    catch { showToast('Invalid JSON in stats field.', 'error'); return; }
  }

  const body = {
    name: document.getElementById('pName').value.trim(),
    role: document.getElementById('pRole').value,
    nationality: document.getElementById('pNationality').value.trim(),
    age: parseInt(document.getElementById('pAge').value) || null,
    base_price: parseInt(document.getElementById('pBasePrice').value),
    image_url: document.getElementById('pImageUrl').value.trim() || null,
    stats,
    status: document.getElementById('pStatus').value
  };

  if (!body.name || !body.nationality || !body.base_price) {
    showToast('Name, nationality and base price are required.', 'error');
    return;
  }

  const url = editId ? `/api/admin/players/${editId}` : '/api/admin/players';
  const method = editId ? 'PUT' : 'POST';
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const data = await res.json();
  if (data.error) { showToast(data.error, 'error'); return; }
  showToast(editId ? 'Player updated!' : 'Player added!');
  closePlayerModal();
  loadPlayers();
}

async function deletePlayer(id) {
  if (!confirm('Delete this player and all their bids?')) return;
  const res = await fetch(`/api/admin/players/${id}`, { method: 'DELETE' });
  const data = await res.json();
  if (data.success) { showToast('Player deleted.'); loadPlayers(); }
  else showToast(data.error, 'error');
}

async function resetBids(id) {
  if (!confirm('Reset all bids for this player?')) return;
  const res = await fetch(`/api/admin/players/${id}/reset`, { method: 'POST' });
  const data = await res.json();
  if (data.success) { showToast('Bids reset.'); loadPlayers(); }
  else showToast(data.error, 'error');
}

async function sellPlayer(id) {
  if (!confirm('Mark this player as SOLD?')) return;
  const res = await fetch(`/api/admin/players/${id}/sell`, { method: 'POST' });
  const data = await res.json();
  if (data.success) { showToast('Player marked as sold!'); loadPlayers(); }
  else showToast(data.error, 'error');
}

document.getElementById('playerModal').addEventListener('click', function(e) {
  if (e.target === this) closePlayerModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && document.getElementById('loginPanel').style.display !== 'none') doLogin();
});

function showToast(msg, type = 'success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

checkSession();

