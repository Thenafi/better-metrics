/**
 * Better Metrics — Frontend Logic
 *
 * Two modes:
 *   URL mode  (?uuid=…): hide controls, show settings icon in header,
 *             auto-fetch with full-page loader, panel slides in on demand.
 *   Manual mode (no URL uuid): show inline controls, user fetches manually.
 */

// ── DOM refs ──────────────────────────────────────────────────────
// The app has two sets of inputs:
//   - #settings-panel inputs (used when UUID is in URL)
//   - inline #controls-row inputs (used when no UUID)
// We alias them through getter functions so the rest of the code
// can call a single canonical source.

let _uuidFromUrl = false;

function getUuidInput()  { return document.getElementById('uuid-input'); }
function getStartInput() { return document.getElementById('start-date'); }
function getEndInput()   { return document.getElementById('end-date'); }

const statusEl  = document.getElementById('status-wrapper');
const resultsEl = document.getElementById('results');

// ── Date helpers ──────────────────────────────────────────────────
function toISO(date) { return date.toISOString().split('T')[0]; }
function today()     { return new Date(); }
function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  const Mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const Dy = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  return `${Dy[d.getDay()]}, ${Mo[d.getMonth()]} ${d.getDate()}`;
}

// ── Loading states ────────────────────────────────────────────────
function showInitialLoader() {
  document.getElementById('initial-loading').style.display = 'flex';
}
function hideInitialLoader() {
  document.getElementById('initial-loading').style.display = 'none';
}
function showHeaderLoader() {
  document.getElementById('header-loading').style.display = 'flex';
}
function hideHeaderLoader() {
  document.getElementById('header-loading').style.display = 'none';
}

// ── Settings panel toggle ─────────────────────────────────────────
function initSettingsToggle() {
  const toggleBtn = document.getElementById('settings-toggle');
  const panel     = document.getElementById('settings-panel');
  if (!toggleBtn) return;

  toggleBtn.style.display = 'flex';   // make it visible
  toggleBtn.addEventListener('click', () => {
    const open = panel.style.display !== 'none';
    panel.style.display = open ? 'none' : 'block';
    panel.setAttribute('aria-hidden', open ? 'true' : 'false');
    toggleBtn.setAttribute('aria-label', open ? 'Open settings' : 'Close settings');
  });
}

// ── Status messages ───────────────────────────────────────────────
function showStatus(kind, title, subtitle) {
  statusEl.innerHTML = `
    <div data-notification class="bx--inline-notification bx--inline-notification--${kind}" role="alert">
      <div class="bx--inline-notification__details">
        <svg focusable="false" xmlns="http://www.w3.org/2000/svg" fill="currentColor"
             class="bx--inline-notification__icon" width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M10 1c-4.9 0-9 4.1-9 9s4.1 9 9 9 9-4.1 9-9-4.1-9-9-9zm-1.2 5.5h2.4V8H8.8V6.5zM12 14.5H8V13h1.5v-2.5H8V9h2.5v4H12v1.5z"/>
        </svg>
        <div class="bx--inline-notification__text-wrapper">
          <p class="bx--inline-notification__title">${escapeHtml(title)}</p>
          <p class="bx--inline-notification__subtitle">${escapeHtml(subtitle)}</p>
        </div>
      </div>
    </div>`;
}
function hideStatus() { statusEl.innerHTML = ''; }
function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// ── Active group-by value ─────────────────────────────────────────
function getGroupBy() {
  // Check whichever switcher is visible
  const btn = document.querySelector(
    '.bx--content-switcher-btn.bx--content-switcher--selected'
  );
  return btn ? btn.dataset.value : 'checkout';
}

// ── Fetch ─────────────────────────────────────────────────────────
async function fetchReservations({ isInitial = false } = {}) {
  const uuid  = getUuidInput()?.value.trim();
  const start = getStartInput()?.value;
  const end   = getEndInput()?.value;

  if (!uuid)         { showStatus('error', 'Missing UUID',  'Please enter a Hospitable View UUID.'); return; }
  if (!start || !end){ showStatus('error', 'Missing Dates', 'Please select start and end dates.');   return; }

  sessionStorage.setItem('bm_uuid', uuid);

  const url = new URL(window.location);
  url.searchParams.set('uuid', uuid);
  window.history.replaceState({}, '', url);

  // Loading UI
  if (isInitial) {
    showInitialLoader();
  } else {
    showHeaderLoader();
  }
  hideStatus();
  resultsEl.innerHTML = '';

  // Close panel after applying
  const panel = document.getElementById('settings-panel');
  if (panel && panel.style.display !== 'none') {
    panel.style.display = 'none';
    panel.setAttribute('aria-hidden', 'true');
    const toggleBtn = document.getElementById('settings-toggle');
    if (toggleBtn) toggleBtn.setAttribute('aria-label', 'Open settings');
  }

  // Disable all fetch buttons
  document.querySelectorAll('#fetch-btn, #fetch-btn-inline').forEach(b => b.disabled = true);

  try {
    const resp = await fetch('/api/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uuid, start, end }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${resp.status}`);
    }

    const { data } = await resp.json();

    if (!data || data.length === 0) {
      showStatus('warning', 'No Results',
        `No reservations found with checkout between ${start} and ${end}.`);
      return;
    }

    renderResults(data);
  } catch (err) {
    showStatus('error', 'Request Failed', err.message);
  } finally {
    hideInitialLoader();
    hideHeaderLoader();
    document.querySelectorAll('#fetch-btn, #fetch-btn-inline').forEach(b => b.disabled = false);
  }
}

// ── Same-day turnover ─────────────────────────────────────────────
// Only flag the CHECK-OUT reservation (someone else checks in the same day)
function isSameDayTurnover(row, allData) {
  if (!row.property_name || !row.checkout_date) return false;
  return allData.some(r =>
    r.property_name === row.property_name &&
    r.checkin_date  === row.checkout_date &&
    r.code !== row.code
  );
}

// ── Render ────────────────────────────────────────────────────────
function renderResults(data) {
  const todayStr = toISO(today());
  const groupBy  = getGroupBy();

  data.sort((a, b) => (a.checkout_date || '').localeCompare(b.checkout_date || ''));

  const groups = new Map();
  for (const row of data) {
    const key = groupBy === 'property'
      ? (row.property_name || 'Unknown Property')
      : (row.checkout_date || 'Unknown Date');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  const todayCheckouts = data.filter(r => r.checkout_date === todayStr).length;
  const sameDayCount   = data.filter(r => isSameDayTurnover(r, data)).length;

  const tilesHtml = `
    <div class="summary-tiles">
      <div class="tile">
        <div class="tile-value" style="color:#0f62fe">${data.length}</div>
        <div class="tile-label">Total reservations</div>
      </div>
      <div class="tile">
        <div class="tile-value" style="color:#007d79">${groups.size}</div>
        <div class="tile-label">${groupBy === 'property' ? 'Properties' : 'Checkout dates'}</div>
      </div>
      <div class="tile">
        <div class="tile-value" style="color:#f1c21b">${todayCheckouts}</div>
        <div class="tile-label">Checking out today</div>
      </div>
      <div class="tile">
        <div class="tile-value" style="color:#24a148">${sameDayCount}</div>
        <div class="tile-label">Same-day turnovers</div>
      </div>
    </div>`;

  // When grouping by checkout, fill in ALL dates in the range so empty days are visible
  if (groupBy === 'checkout') {
    const startStr = getStartInput()?.value;
    const endStr   = getEndInput()?.value;
    if (startStr && endStr) {
      const allDates = new Map();
      let cursor = new Date(startStr + 'T00:00:00');
      const endDate = new Date(endStr + 'T00:00:00');
      while (cursor <= endDate) {
        const iso = toISO(cursor);
        allDates.set(iso, groups.get(iso) || []);
        cursor = addDays(cursor, 1);
      }
      // Also include any dates from data that might fall outside the range
      for (const [key, val] of groups) {
        if (!allDates.has(key)) allDates.set(key, val);
      }
      groups.clear();
      for (const [key, val] of allDates) {
        groups.set(key, val);
      }
    }
  }

  let groupsHtml = '';
  for (const [groupName, reservations] of groups) {
    const displayName = groupBy === 'checkout' ? formatDate(groupName) : groupName;

    if (reservations.length === 0) {
      // Empty day — show a clear "no checkouts" message
      groupsHtml += `
        <div class="data-group data-group--empty">
          <div class="data-group-header data-group-header--empty">
            <span class="data-group-title">${escapeHtml(displayName)}</span>
            <span class="bx--tag bx--tag--cool-gray">0</span>
          </div>
          <div class="data-group-empty-msg">No check-outs</div>
        </div>`;
      continue;
    }

    const rows = reservations.map(r => {
      const guest   = [r.guest_first_name, r.guest_last_name].filter(Boolean).join(' ') || '—';
      const sameDay = isSameDayTurnover(r, data);
      const checkinCell  = r.checkin_date
        ? formatDate(r.checkin_date)
        : '<span class="no-date">No check-in</span>';
      const checkoutCell = r.checkout_date
        ? `<strong>${formatDate(r.checkout_date)}</strong>`
        : '<span class="no-date">No check-out</span>';
      return `
        <tr>
          <td>${checkinCell}</td>
          <td>${checkoutCell}</td>
          <td>${escapeHtml(guest)}</td>
          <td><code style="background:#e8e8e8;padding:1px 5px;font-size:.8em">${escapeHtml(r.code || '—')}</code></td>
          <td>${escapeHtml(r.property_name || '—')}</td>
          <td>${sameDay
            ? '<span class="bx--tag bx--tag--green" style="white-space:nowrap">Yes</span>'
            : '<span style="color:#a8a8a8">—</span>'}</td>
        </tr>`;
    }).join('');

    groupsHtml += `
      <div class="data-group">
        <div class="data-group-header">
          <span class="data-group-title">${escapeHtml(displayName)}</span>
          <span class="bx--tag bx--tag--blue">${reservations.length}</span>
        </div>
        <div class="bx--data-table-container table-responsive-wrap">
          <table class="bx--data-table bx--data-table--zebra bx--data-table--compact">
            <thead>
              <tr>
                <th><span class="bx--table-header-label">Check-in</span></th>
                <th><span class="bx--table-header-label">Check-out</span></th>
                <th><span class="bx--table-header-label">Guest</span></th>
                <th><span class="bx--table-header-label">Code</span></th>
                <th><span class="bx--table-header-label">Listing</span></th>
                <th><span class="bx--table-header-label">Same&nbsp;day</span></th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  }

  resultsEl.innerHTML = tilesHtml + groupsHtml;
}

// ── Init ──────────────────────────────────────────────────────────
function init() {
  const params  = new URLSearchParams(window.location.search);
  const urlUuid = params.get('uuid');
  const now     = today();

  if (urlUuid) {
    // ── URL mode: shared link ──────────────────────────────────────
    _uuidFromUrl = true;

    // Wire up the settings-panel inputs
    getUuidInput().value  = urlUuid;
    getStartInput().value = toISO(now);
    getEndInput().value   = toISO(addDays(now, 7));

    // Show settings panel controls (not UUID field — it's baked into URL)
    document.getElementById('uuid-container').style.display = 'none';

    // Show the settings toggle button in header
    initSettingsToggle();
    document.getElementById('settings-panel').style.display = 'none'; // starts closed

    // Auto-fetch on load with big spinner
    fetchReservations({ isInitial: true });

  } else {
    // ── Manual mode: show inline controls ─────────────────────────
    const saved = sessionStorage.getItem('bm_uuid');

    // Mirror inline inputs into the canonical panel inputs
    const inlineUuid  = document.getElementById('uuid-input-inline');
    const inlineStart = document.getElementById('start-date-inline');
    const inlineEnd   = document.getElementById('end-date-inline');

    if (inlineUuid && saved) inlineUuid.value = saved;
    if (inlineStart) inlineStart.value = toISO(now);
    if (inlineEnd)   inlineEnd.value   = toISO(addDays(now, 7));

    // Keep canonical inputs in sync with inline ones
    if (inlineUuid)  inlineUuid.addEventListener('input',  () => getUuidInput().value  = inlineUuid.value);
    if (inlineStart) inlineStart.addEventListener('change', () => getStartInput().value = inlineStart.value);
    if (inlineEnd)   inlineEnd.addEventListener('change',   () => getEndInput().value   = inlineEnd.value);

    // Mirror inline switcher to panel switcher
    document.querySelectorAll('#group-switcher-inline .bx--content-switcher-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        // Sync active state to both switchers
        document.querySelectorAll('.bx--content-switcher-btn').forEach(b => {
          if (b.dataset.value === btn.dataset.value) b.classList.add('bx--content-switcher--selected');
          else b.classList.remove('bx--content-switcher--selected');
        });
      });
    });

    // Pre-fill canonical from inline
    if (saved) getUuidInput().value = saved;
    getStartInput().value = toISO(now);
    getEndInput().value   = toISO(addDays(now, 7));

    document.getElementById('controls-row').style.display = 'block';
    document.getElementById('uuid-container-inline').style.display = 'block';
  }
}

// ── Events ────────────────────────────────────────────────────────

// Settings-panel fetch button
document.getElementById('fetch-btn').addEventListener('click', () => fetchReservations());

// Inline fetch button (manual mode)
document.getElementById('fetch-btn-inline').addEventListener('click', () => fetchReservations());

// Both switchers: re-fetch when group is changed after data is loaded
document.querySelectorAll('.bx--content-switcher-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    // Sync all switchers
    document.querySelectorAll('.bx--content-switcher-btn').forEach(b => {
      if (b.dataset.value === btn.dataset.value) b.classList.add('bx--content-switcher--selected');
      else b.classList.remove('bx--content-switcher--selected');
    });
    if (resultsEl.children.length > 0) fetchReservations();
  });
});

// Keyboard shortcut: Enter in any text/date input
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && (e.target.tagName === 'INPUT')) fetchReservations();
});

init();
