// ============================================================
// DATA LAYER
// To swap localStorage for Google Sheets, replace only these
// two functions. Everything else calls saveData / loadData.
// ============================================================
function saveData(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function loadData(key) {
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : null;
}
// ============================================================

// ============================================================
// SEED DATA — loaded once on first visit
// ============================================================
const SEED_LIBRARY = [
  { id: 'ex1', name: 'Glute bridges 10 x 3', type: 'Exercise' },
  { id: 'ex2', name: 'Piriformis sitting hip stretch', type: 'Stretch' },
  { id: 'ex3', name: 'Hip hinge side bridge 8 x 5sec x 2', type: 'Exercise' },
  { id: 'ex4', name: 'Hip flexor stretch', type: 'Stretch' },
  { id: 'ex5', name: 'Clamshell 8 x 5sec x 2', type: 'Exercise' },
  { id: 'ex6', name: 'Hip over bottle 8 x 2', type: 'Exercise' },
  { id: 'ex7', name: 'Swings', type: 'Exercise' },
];

const SEED_SCHEDULE = {
  Monday:    [],
  Tuesday:   [],
  Wednesday: [],
  Thursday:  [],
  Friday:    [],
  Saturday:  [],
  Sunday:    [],
};

const SEED_PAINS = [
  { id: 'p1', name: 'Left hip flexor' },
];

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function initSeedData() {
  if ((loadData('dataVersion') || 0) < 4) {
    saveData('library', SEED_LIBRARY);
    saveData('schedule', SEED_SCHEDULE);
    saveData('dataVersion', 4);
  }
  if (!loadData('pains')) saveData('pains', SEED_PAINS);
}
// ============================================================

// ============================================================
// DATE UTILITIES
// ============================================================
function getToday() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getDayName() {
  const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return names[new Date().getDay()];
}

function formatHeading() {
  const d = new Date();
  const day = getDayName();
  const month = d.toLocaleString('default', { month: 'long' });
  return `${day}, ${month} ${d.getDate()}`;
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function formatPace(distance, time) {
  if (!distance || !time || distance <= 0 || time <= 0) return '';
  const paceMin = time / distance;
  const mins = Math.floor(paceMin);
  const secs = Math.round((paceMin - mins) * 60);
  return `${mins}:${secs.toString().padStart(2, '0')}/km`;
}
// ============================================================

// ============================================================
// TAB SWITCHING
// ============================================================
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${tab}`).classList.add('active');
      if (tab === 'today')     renderToday();
      if (tab === 'schedule')  renderSchedule();
      if (tab === 'exercises') renderExercises();
      if (tab === 'pains')     renderPains();
      if (tab === 'history')   renderHistory();
    });
  });
}
// ============================================================

// ============================================================
// TODAY TAB
// ============================================================
function renderToday() {
  const today = getToday();
  document.getElementById('today-heading').textContent = formatHeading();

  const todayData  = loadData(`today-${today}`) || { checks: {}, difficulty: {}, adhoc: [] };
  if (!todayData.difficulty) todayData.difficulty = {};
  const schedule   = loadData('schedule') || {};
  const library    = loadData('library') || [];
  const dayName    = getDayName();
  const scheduledIds = schedule[dayName] || [];

  const list = document.getElementById('today-checklist');
  list.innerHTML = '';

  if (scheduledIds.length === 0 && todayData.adhoc.length === 0) {
    list.innerHTML = '<li class="empty">Nothing scheduled today — add something below!</li>';
  }

  scheduledIds.forEach(id => {
    const ex = library.find(e => e.id === id);
    if (!ex) return;
    list.appendChild(makeCheckItem(id, ex.name, ex.type, !!todayData.checks[id], todayData.difficulty[id]));
  });

  todayData.adhoc.forEach((item, idx) => {
    const libMatch = library.find(ex => ex.name.toLowerCase() === item.name.toLowerCase());
    const id = libMatch ? libMatch.id : `adhoc-${idx}`;
    list.appendChild(makeCheckItem(id, item.name, item.type, !!todayData.checks[id], todayData.difficulty[id]));
  });

  renderRunLog(today);
  renderWeightLog(today);
  renderPainCheck(today);
}

function makeCheckItem(id, name, type, checked, difficulty) {
  const li = document.createElement('li');
  li.className = 'check-item' + (checked ? ' checked' : '');
  li.innerHTML = `
    <label class="check-label">
      <input type="checkbox" data-id="${id}" ${checked ? 'checked' : ''}>
      <span class="item-name">${escHtml(name)}</span>
      <span class="type-tag type-${type.toLowerCase()}">${escHtml(type)}</span>
    </label>
    <input type="number" class="difficulty-input" min="1" max="10"
           value="${difficulty || ''}" placeholder="diff" data-id="${id}" title="Difficulty 1–10">`;
  li.querySelector('input[type="checkbox"]').addEventListener('change', e => {
    toggleCheck(id, e.target.checked);
    li.classList.toggle('checked', e.target.checked);
  });
  li.querySelector('.difficulty-input').addEventListener('change', e => {
    const score = parseInt(e.target.value, 10);
    if (isNaN(score) || score < 1 || score > 10) { e.target.value = ''; return; }
    const today = getToday();
    const data = loadData(`today-${today}`) || { checks: {}, difficulty: {}, adhoc: [] };
    if (!data.difficulty) data.difficulty = {};
    data.difficulty[id] = score;
    saveData(`today-${today}`, data);
  });
  return li;
}

function toggleCheck(id, checked) {
  const today = getToday();
  const data = loadData(`today-${today}`) || { checks: {}, adhoc: [] };
  data.checks[id] = checked;
  saveData(`today-${today}`, data);
}

function initAdhoc() {
  document.getElementById('adhoc-add').addEventListener('click', addAdhoc);
  document.getElementById('adhoc-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') addAdhoc();
  });
  document.getElementById('adhoc-name').addEventListener('input', e => {
    const library = loadData('library') || [];
    const match = library.find(ex => ex.name.toLowerCase() === e.target.value.toLowerCase());
    if (match) document.getElementById('adhoc-type').value = match.type;
  });
  populateAdhocSuggestions();
}

function populateAdhocSuggestions() {
  const library = loadData('library') || [];
  const dl = document.getElementById('exercise-suggestions');
  if (dl) dl.innerHTML = library.map(ex => `<option value="${escHtml(ex.name)}">`).join('');
}

function addAdhoc() {
  const nameEl = document.getElementById('adhoc-name');
  const typeEl = document.getElementById('adhoc-type');
  const name = nameEl.value.trim();
  if (!name) { nameEl.focus(); return; }

  // If it's not already in the library, add it
  const library = loadData('library') || [];
  const exists = library.some(ex => ex.name.toLowerCase() === name.toLowerCase());
  if (!exists) {
    library.push({ id: generateId(), name, type: typeEl.value });
    saveData('library', library);
    populateAdhocSuggestions();
  }

  const today = getToday();
  const data = loadData(`today-${today}`) || { checks: {}, difficulty: {}, adhoc: [] };
  data.adhoc.push({ name, type: typeEl.value });
  saveData(`today-${today}`, data);
  nameEl.value = '';
  renderToday();
}

// Run log
function renderRunLog(today) {
  const run = loadData(`run-${today}`);
  const logged = run && run.logged;
  document.getElementById('run-card').classList.toggle('card-logged', logged);
  document.getElementById('run-check-icon').textContent = logged ? '✓' : '';
  if (logged) {
    document.getElementById('run-distance').value = run.distance || '';
    document.getElementById('run-time').value     = run.time || '';
    document.getElementById('run-feeling').value  = run.feeling || '';
    document.getElementById('run-notes').value    = run.notes || '';
    document.getElementById('run-save').textContent = 'Update run';
    document.getElementById('run-pace').textContent = run.distance && run.time ? `Pace: ${formatPace(run.distance, run.time)}` : '';
  } else {
    document.getElementById('run-save').textContent = 'Save run';
    document.getElementById('run-pace').textContent = '';
  }
}

function initRunLog() {
  document.getElementById('run-save').addEventListener('click', () => {
    const distance = parseFloat(document.getElementById('run-distance').value);
    const time     = parseFloat(document.getElementById('run-time').value);
    const feeling  = parseInt(document.getElementById('run-feeling').value, 10);
    const notes    = document.getElementById('run-notes').value.trim();

    if (feeling && (feeling < 1 || feeling > 10)) { alert('Feeling must be between 1 and 10.'); return; }

    const today = getToday();
    saveData(`run-${today}`, {
      distance: distance || null,
      time: time || null,
      feeling: feeling || null,
      notes,
      logged: true,
      loggedAt: new Date().toISOString()
    });
    renderRunLog(today);
  });
}

// Weight log
function renderWeightLog(today) {
  const weight = loadData(`weight-${today}`);
  const logged = weight && weight.logged;
  document.getElementById('weight-card').classList.toggle('card-logged', logged);
  document.getElementById('weight-check-icon').textContent = logged ? '✓' : '';
  if (logged) {
    document.getElementById('weight-value').value = weight.value || '';
    document.getElementById('weight-notes').value = weight.notes || '';
    document.getElementById('weight-save').textContent = 'Update weight';
  } else {
    document.getElementById('weight-save').textContent = 'Save weight';
  }
}

function initWeightLog() {
  document.getElementById('weight-save').addEventListener('click', () => {
    const value = parseFloat(document.getElementById('weight-value').value);
    const notes = document.getElementById('weight-notes').value.trim();
    const today = getToday();
    saveData(`weight-${today}`, { value: value || null, notes, logged: true, loggedAt: new Date().toISOString() });
    document.getElementById('weight-save').textContent = 'Update weight';
  });
}

// Pain check
function renderPainCheck(today) {
  const pains   = loadData('pains') || [];
  const painLog = loadData(`painlog-${today}`) || {};
  const list    = document.getElementById('pain-check-list');
  list.innerHTML = '';

  if (pains.length === 0) {
    list.innerHTML = '<li class="empty">No pains tracked. Add one in the Pains tab.</li>';
    return;
  }

  pains.forEach(pain => {
    const li = document.createElement('li');
    const isLogged = painLog[pain.id] !== undefined;
    li.className = 'pain-item' + (isLogged ? ' logged' : '');
    const currentVal = isLogged ? painLog[pain.id] : '';
    li.innerHTML = `
      <span class="pain-check-icon">${isLogged ? '✓' : ''}</span>
      <span class="pain-name">${escHtml(pain.name)}</span>
      <input type="number" class="pain-score" min="0" max="10"
             value="${currentVal}" placeholder="0–10" data-id="${pain.id}">`;
    list.appendChild(li);
  });

  const updateBtn = document.getElementById('pain-update');
  updateBtn.style.display = 'inline-block';
  updateBtn.onclick = () => {
    const inputs = list.querySelectorAll('.pain-score');
    const pl = loadData(`painlog-${today}`) || {};
    let anyFilled = false;
    inputs.forEach(input => {
      const score = parseInt(input.value, 10);
      if (!isNaN(score) && score >= 0 && score <= 10) {
        pl[input.dataset.id] = score;
        anyFilled = true;
        const li = input.closest('.pain-item');
        li.classList.add('logged');
        li.querySelector('.pain-check-icon').textContent = '✓';
      }
    });
    if (anyFilled) {
      saveData(`painlog-${today}`, pl);
      updateBtn.textContent = 'Updated ✓';
      setTimeout(() => { updateBtn.textContent = 'Update'; }, 1500);
    }
  };
}
// ============================================================

// ============================================================
// SCHEDULE TAB
// Event listener added once via initSchedule(); renderSchedule()
// only rebuilds the innerHTML.
// ============================================================
function initSchedule() {
  const container = document.getElementById('schedule-days');
  container.addEventListener('click', e => {
    if (e.target.classList.contains('pill-remove')) {
      removeFromSchedule(e.target.dataset.day, e.target.dataset.id);
    }
    if (e.target.classList.contains('schedule-add-btn')) {
      const day = e.target.dataset.day;
      const select = container.querySelector(`.schedule-select[data-day="${day}"]`);
      if (select && select.value) {
        addToSchedule(day, select.value);
        select.value = '';
      }
    }
  });
}

function renderSchedule() {
  const schedule = loadData('schedule') || {};
  const library  = loadData('library') || [];
  const container = document.getElementById('schedule-days');
  container.innerHTML = '';

  DAYS.forEach(day => {
    const ids = schedule[day] || [];
    const card = document.createElement('div');
    card.className = 'card day-card';

    const pillsHtml = ids.length
      ? ids.map(id => {
          const ex = library.find(e => e.id === id);
          if (!ex) return '';
          return `<span class="pill">${escHtml(ex.name)}<button class="pill-remove" data-day="${day}" data-id="${id}" aria-label="Remove">×</button></span>`;
        }).join('')
      : '<span class="empty-pills">Nothing scheduled</span>';

    const optionsHtml = library.map(ex =>
      `<option value="${ex.id}">${escHtml(ex.name)} (${ex.type})</option>`
    ).join('');

    card.innerHTML = `
      <h3>${day}</h3>
      <div class="pills">${pillsHtml}</div>
      <div class="schedule-add">
        <select class="schedule-select" data-day="${day}">
          <option value="">— pick an exercise —</option>
          ${optionsHtml}
        </select>
        <button class="schedule-add-btn" data-day="${day}">Add</button>
      </div>`;

    container.appendChild(card);
  });
}

function addToSchedule(day, id) {
  const schedule = loadData('schedule') || {};
  if (!schedule[day]) schedule[day] = [];
  if (!schedule[day].includes(id)) {
    schedule[day].push(id);
    saveData('schedule', schedule);
  }
  renderSchedule();
}

function removeFromSchedule(day, id) {
  const schedule = loadData('schedule') || {};
  if (!schedule[day]) return;
  schedule[day] = schedule[day].filter(i => i !== id);
  saveData('schedule', schedule);
  renderSchedule();
}
// ============================================================

// ============================================================
// EXERCISES TAB
// ============================================================
function renderExercises() {
  const library = loadData('library') || [];
  const list = document.getElementById('exercise-list');
  list.innerHTML = '';

  if (library.length === 0) {
    list.innerHTML = '<li class="empty">No exercises yet. Add one above!</li>';
    return;
  }

  library.forEach(ex => {
    const li = document.createElement('li');
    li.className = 'exercise-item';
    li.innerHTML = `
      <span class="item-name">${escHtml(ex.name)}</span>
      <span class="type-tag type-${ex.type.toLowerCase()}">${escHtml(ex.type)}</span>
      <button class="remove-btn" aria-label="Remove">×</button>`;
    li.querySelector('.remove-btn').addEventListener('click', () => removeExercise(ex.id));
    list.appendChild(li);
  });
}

function initExercises() {
  document.getElementById('exercise-add').addEventListener('click', addExercise);
  document.getElementById('exercise-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') addExercise();
  });
}

function addExercise() {
  const nameEl = document.getElementById('exercise-name');
  const typeEl = document.getElementById('exercise-type');
  const name = nameEl.value.trim();
  if (!name) { nameEl.focus(); return; }

  const library = loadData('library') || [];
  library.push({ id: generateId(), name, type: typeEl.value });
  saveData('library', library);
  nameEl.value = '';
  renderExercises();
}

function removeExercise(id) {
  if (!confirm('Remove this exercise from the library? It will also be removed from all days in the schedule.')) return;
  const library = (loadData('library') || []).filter(e => e.id !== id);
  saveData('library', library);
  const schedule = loadData('schedule') || {};
  DAYS.forEach(day => {
    if (schedule[day]) schedule[day] = schedule[day].filter(i => i !== id);
  });
  saveData('schedule', schedule);
  renderExercises();
}
// ============================================================

// ============================================================
// PAINS TAB
// ============================================================
function renderPains() {
  const pains = loadData('pains') || [];
  const list  = document.getElementById('pain-list');
  list.innerHTML = '';

  if (pains.length === 0) {
    list.innerHTML = '<li class="empty">No pains tracked yet.</li>';
    return;
  }

  pains.forEach(pain => {
    const li = document.createElement('li');
    li.className = 'pain-list-item';
    li.innerHTML = `
      <span>${escHtml(pain.name)}</span>
      <button class="remove-btn" aria-label="Remove">×</button>`;
    li.querySelector('.remove-btn').addEventListener('click', () => removePain(pain.id));
    list.appendChild(li);
  });
}

function initPains() {
  document.getElementById('pain-add').addEventListener('click', addPain);
  document.getElementById('pain-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') addPain();
  });
}

function addPain() {
  const nameEl = document.getElementById('pain-name');
  const name = nameEl.value.trim();
  if (!name) { nameEl.focus(); return; }

  const pains = loadData('pains') || [];
  pains.push({ id: generateId(), name });
  saveData('pains', pains);
  nameEl.value = '';
  renderPains();
}

function removePain(id) {
  if (!confirm('Stop tracking this pain?')) return;
  const pains = (loadData('pains') || []).filter(p => p.id !== id);
  saveData('pains', pains);
  renderPains();
}
// ============================================================

// ============================================================
// HISTORY TAB
// ============================================================
function renderHistory() {
  const library = loadData('library') || [];
  const pains   = loadData('pains') || [];
  const runs = [], weights = [], todayByDate = {}, painByDate = {};

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (key.startsWith('run-')) {
      const r = loadData(key);
      if (r && r.logged) runs.push({ date: key.slice(4), ...r });
    }
    if (key.startsWith('weight-')) {
      const w = loadData(key);
      if (w && w.logged) weights.push({ date: key.slice(7), ...w });
    }
    if (key.startsWith('today-')) {
      const d = loadData(key);
      if (d) todayByDate[key.slice(6)] = d;
    }
    if (key.startsWith('painlog-')) {
      const pl = loadData(key);
      if (pl && Object.keys(pl).length > 0) painByDate[key.slice(8)] = pl;
    }
  }

  runs.sort((a, b) => b.date.localeCompare(a.date));
  weights.sort((a, b) => b.date.localeCompare(a.date));

  const recentRuns    = runs.slice(0, 7);
  const recentWeights = weights.slice(0, 7);

  // Dates that have any exercise activity (checks or difficulty)
  const exDates = Object.keys(todayByDate)
    .filter(d => {
      const t = todayByDate[d];
      const hasChecks = t.checks && Object.values(t.checks).some(v => v);
      const hasDiff   = t.difficulty && Object.keys(t.difficulty).length > 0;
      return hasChecks || hasDiff;
    })
    .sort((a, b) => b.localeCompare(a)).slice(0, 7).reverse();

  const painDates = Object.keys(painByDate)
    .sort((a, b) => b.localeCompare(a)).slice(0, 7).reverse();

  // ---- Runs ----
  const runsEl = document.getElementById('history-runs');
  if (recentRuns.length === 0) {
    runsEl.innerHTML = '<div class="card"><h2>Runs</h2><p class="empty">No runs logged yet.</p></div>';
  } else {
    runsEl.innerHTML = `
      <div class="card">
        <h2>Runs <span class="history-count">(last ${recentRuns.length})</span></h2>
        <div class="history-table-wrap">
          <table class="history-table">
            <thead><tr><th>Date</th><th>Dist</th><th>Time</th><th>Pace</th><th>Feel</th><th></th></tr></thead>
            <tbody>${recentRuns.map(r => `
              <tr>
                <td>${formatDate(r.date)}</td>
                <td>${r.distance ? r.distance + ' km' : '—'}</td>
                <td>${r.time ? r.time + ' min' : '—'}</td>
                <td>${r.distance && r.time ? formatPace(r.distance, r.time) : '—'}</td>
                <td>${r.feeling || '—'}</td>
                <td><button class="hist-del-btn" data-type="run" data-date="${r.date}">×</button></td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
    runsEl.querySelectorAll('.hist-del-btn').forEach(btn => {
      btn.addEventListener('click', () => deleteHistoryEntry(btn.dataset.type, btn.dataset.date));
    });
  }

  // ---- Weight ----
  const weightEl = document.getElementById('history-weight');
  if (recentWeights.length === 0) {
    weightEl.innerHTML = '<div class="card"><h2>Weight</h2><p class="empty">No weight logged yet.</p></div>';
  } else {
    weightEl.innerHTML = `
      <div class="card">
        <h2>Weight <span class="history-count">(last ${recentWeights.length})</span></h2>
        <div class="history-table-wrap">
          <table class="history-table">
            <thead><tr><th>Date</th><th>Weight</th><th>Notes</th><th></th></tr></thead>
            <tbody>${recentWeights.map(w => `
              <tr>
                <td>${formatDate(w.date)}</td>
                <td>${w.value ? w.value + ' kg' : '—'}</td>
                <td class="notes-cell">${escHtml(w.notes || '')}</td>
                <td><button class="hist-del-btn" data-type="weight" data-date="${w.date}">×</button></td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
    weightEl.querySelectorAll('.hist-del-btn').forEach(btn => {
      btn.addEventListener('click', () => deleteHistoryEntry(btn.dataset.type, btn.dataset.date));
    });
  }

  // ---- Exercises (ticks + difficulty) ----
  const diffEl = document.getElementById('history-difficulty');
  if (exDates.length === 0) {
    diffEl.innerHTML = '<div class="card"><h2>Exercises</h2><p class="empty">Tick exercises or add difficulty scores in Today\'s Plan to see history here.</p></div>';
  } else {
    const allExIds = new Set();
    exDates.forEach(date => {
      const t = todayByDate[date];
      if (t.checks) Object.keys(t.checks).forEach(id => { if (t.checks[id]) allExIds.add(id); });
      if (t.difficulty) Object.keys(t.difficulty).forEach(id => allExIds.add(id));
    });

    const adhocNameById = {};
    exDates.forEach(date => {
      const t = todayByDate[date];
      if (!t.adhoc) return;
      t.adhoc.forEach((item, idx) => {
        const adhocId = `adhoc-${idx}`;
        if (allExIds.has(adhocId)) adhocNameById[adhocId] = item.name;
      });
    });

    const relevantEx = [
      ...library.filter(ex => allExIds.has(ex.id)),
      ...Object.entries(adhocNameById).map(([id, name]) => ({ id, name, type: 'Other' }))
    ];

    const rows = relevantEx.map(ex => {
      const cells = exDates.map(date => {
        const t = todayByDate[date] || {};
        const done  = t.checks && t.checks[ex.id];
        const score = t.difficulty && t.difficulty[ex.id];
        if (done && score) return `<td><span class="diff-badge diff-${diffBand(score)}">${score}</span></td>`;
        if (done)          return `<td><span class="done-tick">✓</span></td>`;
        if (score)         return `<td><span class="diff-badge diff-${diffBand(score)}">${score}</span></td>`;
        return `<td><span class="diff-empty">—</span></td>`;
      });
      return `<tr>
        <td class="ex-name-cell">${escHtml(ex.name)}</td>
        ${cells.join('')}
        <td><button class="hist-del-btn" data-type="exercise-row" data-exid="${ex.id}" data-dates="${exDates.join(',')}">×</button></td>
      </tr>`;
    });

    const dateHeaders = exDates.map(d => `<th>${formatDate(d)}</th>`).join('');
    diffEl.innerHTML = `
      <div class="card">
        <h2>Exercises <span class="history-count">(last ${exDates.length} sessions)</span></h2>
        <p class="caption">✓ = completed &nbsp;·&nbsp; number = difficulty score</p>
        <div class="history-table-wrap">
          <table class="history-table diff-table">
            <thead><tr><th>Exercise</th>${dateHeaders}<th></th></tr></thead>
            <tbody>${rows.join('')}</tbody>
          </table>
        </div>
      </div>`;
    diffEl.querySelectorAll('.hist-del-btn').forEach(btn => {
      btn.addEventListener('click', () => deleteExerciseRow(btn.dataset.exid, btn.dataset.dates.split(',')));
    });
  }

  // ---- Pain history ----
  const painHistEl = document.getElementById('history-pains');
  if (painDates.length === 0 || pains.length === 0) {
    painHistEl.innerHTML = '<div class="card"><h2>Pain History</h2><p class="empty">No pain scores logged yet.</p></div>';
  } else {
    const rows = pains.map(pain => {
      const cells = painDates.map(date => {
        const score = painByDate[date] && painByDate[date][pain.id];
        if (score === undefined) return `<td><span class="diff-empty">—</span></td>`;
        return `<td><span class="diff-badge diff-${painBand(score)}">${score}</span></td>`;
      });
      return `<tr>
        <td class="ex-name-cell">${escHtml(pain.name)}</td>
        ${cells.join('')}
        <td><button class="hist-del-btn" data-painid="${pain.id}" data-dates="${painDates.join(',')}">×</button></td>
      </tr>`;
    }).filter((_, i) => painDates.some(date => painByDate[date] && painByDate[date][pains[i].id] !== undefined));

    if (rows.length === 0) {
      painHistEl.innerHTML = '<div class="card"><h2>Pain History</h2><p class="empty">No pain scores logged yet.</p></div>';
    } else {
      const dateHeaders = painDates.map(d => `<th>${formatDate(d)}</th>`).join('');
      painHistEl.innerHTML = `
        <div class="card">
          <h2>Pain History <span class="history-count">(last ${painDates.length} days)</span></h2>
          <p class="caption">0 = no pain &nbsp;·&nbsp; 10 = worst imaginable</p>
          <div class="history-table-wrap">
            <table class="history-table diff-table">
              <thead><tr><th>Pain</th>${dateHeaders}<th></th></tr></thead>
              <tbody>${rows.join('')}</tbody>
            </table>
          </div>
        </div>`;
      painHistEl.querySelectorAll('.hist-del-btn').forEach(btn => {
        btn.addEventListener('click', () => deletePainRow(btn.dataset.painid, btn.dataset.dates.split(',')));
      });
    }
  }

  document.getElementById('download-btn').onclick = downloadAllData;
}

function deleteHistoryEntry(type, date) {
  const labels = { run: 'this run', weight: 'this weight entry' };
  if (!confirm(`Delete ${labels[type] || 'this entry'}?`)) return;
  if (type === 'run')    localStorage.removeItem(`run-${date}`);
  if (type === 'weight') localStorage.removeItem(`weight-${date}`);
  renderHistory();
}

function deleteExerciseRow(exId, dates) {
  if (!confirm('Remove this exercise from the history shown?')) return;
  dates.forEach(date => {
    const d = loadData(`today-${date}`);
    if (!d) return;
    if (d.checks)     delete d.checks[exId];
    if (d.difficulty) delete d.difficulty[exId];
    saveData(`today-${date}`, d);
  });
  renderHistory();
}

function deletePainRow(painId, dates) {
  if (!confirm('Remove this pain from the history shown?')) return;
  dates.forEach(date => {
    const pl = loadData(`painlog-${date}`);
    if (!pl) return;
    delete pl[painId];
    saveData(`painlog-${date}`, pl);
  });
  renderHistory();
}

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}`;
}

function diffBand(score) {
  if (score <= 3) return 'low';
  if (score <= 6) return 'mid';
  return 'high';
}

function painBand(score) {
  if (score <= 2) return 'low';
  if (score <= 5) return 'mid';
  return 'high';
}
// ============================================================

// ============================================================
// DATA EXPORT
// ============================================================
function renderSyncArea() {
  // Download button now lives in the History tab
}

function collectData() {
  const painNames = {};
  (loadData('pains') || []).forEach(p => { painNames[p.id] = p.name; });

  const runs = [], weight = [], pains = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;

    if (key.startsWith('run-')) {
      const r = loadData(key);
      if (r && r.logged) {
        const date = key.slice(4);
        runs.push([date, r.distance || '', r.time || '',
          r.distance && r.time ? formatPace(r.distance, r.time) : '',
          r.feeling || '', r.notes || '']);
      }
    }
    if (key.startsWith('weight-')) {
      const w = loadData(key);
      if (w && w.logged) {
        const date = key.slice(7);
        weight.push([date, w.value || '', w.notes || '']);
      }
    }
    if (key.startsWith('painlog-')) {
      const pl = loadData(key);
      if (pl) {
        const date = key.slice(8);
        Object.entries(pl).forEach(([id, score]) => {
          pains.push([date, painNames[id] || id, score]);
        });
      }
    }
  }

  runs.sort((a, b) => a[0].localeCompare(b[0]));
  weight.sort((a, b) => a[0].localeCompare(b[0]));
  pains.sort((a, b) => a[0].localeCompare(b[0]));

  return { runs, weight, pains };
}

function toCSV(headers, rows) {
  const escape = val => `"${String(val).replace(/"/g, '""')}"`;
  return [headers, ...rows].map(row => row.map(escape).join(',')).join('\n');
}

function triggerDownload(filename, csvContent) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadAllData() {
  const { runs, weight, pains } = collectData();
  const today = getToday();

  if (!runs.length && !weight.length && !pains.length) {
    alert('No data logged yet to download.');
    return;
  }

  const btn = document.getElementById('download-btn');
  btn.textContent = 'Downloading…';
  btn.disabled = true;

  if (runs.length) {
    triggerDownload(`runs-${today}.csv`,
      toCSV(['Date','Distance (km)','Time (min)','Pace','Feeling (1-10)','Notes'], runs));
  }
  setTimeout(() => {
    if (weight.length) {
      triggerDownload(`weight-${today}.csv`,
        toCSV(['Date','Weight (kg)','Notes'], weight));
    }
  }, 400);
  setTimeout(() => {
    if (pains.length) {
      triggerDownload(`pains-${today}.csv`,
        toCSV(['Date','Pain','Score (0-10)'], pains));
    }
    btn.textContent = 'Download data as CSV';
    btn.disabled = false;
  }, 800);
}
// ============================================================

// ============================================================
// UTILITY
// ============================================================
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
// ============================================================

// ============================================================
// INIT
// ============================================================
function init() {
  initSeedData();
  initTabs();
  initAdhoc();
  initRunLog();
  initWeightLog();
  initPains();
  initExercises();
  initSchedule();
  renderToday();
  renderSyncArea();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', init);
// ============================================================
