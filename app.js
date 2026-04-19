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

  const todayData  = loadData(`today-${today}`) || { checks: {}, adhoc: [] };
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
    list.appendChild(makeCheckItem(id, ex.name, ex.type, !!todayData.checks[id]));
  });

  todayData.adhoc.forEach((item, idx) => {
    const id = `adhoc-${idx}`;
    list.appendChild(makeCheckItem(id, item.name, item.type, !!todayData.checks[id]));
  });

  renderRunLog(today);
  renderWeightLog(today);
  renderPainCheck(today);
}

function makeCheckItem(id, name, type, checked) {
  const li = document.createElement('li');
  li.className = 'check-item' + (checked ? ' checked' : '');
  li.innerHTML = `
    <label>
      <input type="checkbox" data-id="${id}" ${checked ? 'checked' : ''}>
      <span class="item-name">${escHtml(name)}</span>
      <span class="type-tag type-${type.toLowerCase()}">${escHtml(type)}</span>
    </label>`;
  li.querySelector('input').addEventListener('change', e => {
    toggleCheck(id, e.target.checked);
    li.classList.toggle('checked', e.target.checked);
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
}

function addAdhoc() {
  const nameEl = document.getElementById('adhoc-name');
  const typeEl = document.getElementById('adhoc-type');
  const name = nameEl.value.trim();
  if (!name) { nameEl.focus(); return; }

  const today = getToday();
  const data = loadData(`today-${today}`) || { checks: {}, adhoc: [] };
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

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', init);
// ============================================================
