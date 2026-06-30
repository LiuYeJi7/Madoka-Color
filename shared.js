// shared.js — client-side data + auth using localStorage
const STORE_KEY = 'barberreserva_v1';

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return null;
}
function save(state) { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }

function seedIfEmpty() {
  let s = load();
  if (s && s.services && s.services.length) {
    // upgrade: add age to seed users if missing
    const defaults = { 'admin@demo.com': 38, 'carlos@demo.com': 29, 'lucia@demo.com': 32 };
    let changed = false;
    if (s.users) s.users.forEach(u => {
      if (u.age == null && defaults[u.email] != null) { u.age = defaults[u.email]; changed = true; }
    });
    if (s.services) s.services.forEach((svc, i) => {
      const icons = ['scissors','razor','beard','paint','spark'];
      if (!svc.icon && icons[i]) { svc.icon = icons[i]; changed = true; }
    });
    if (changed) save(s);
    return s;
  }
s = {
    users: [
      { id: 1, name: 'Javier (Administrador)', email: 'admin@peluqueria.com', phone: '954936982', age: 35, role: 'admin', password: 'admin' },
      { id: 2, name: 'Marizol', email: 'marizol@peluqueria.com', phone: '999111111', age: 25, role: 'employee', commission_rate: 30, password: '123' },
      { id: 3, name: 'Trabajador Dos', email: 't2@peluqueria.com', phone: '999222222', age: 28, role: 'employee', commission_rate: 30, password: '123' },
      { id: 4, name: 'Trabajador Tres', email: 't3@peluqueria.com', phone: '999333333', age: 30, role: 'employee', commission_rate: 30, password: '123' },
      { id: 5, name: 'Trabajador Cuatro', email: 't4@peluqueria.com', phone: '999444444', age: 24, role: 'employee', commission_rate: 30, password: '123' },
    ],
    services: [
      { id: 1, name: 'Corte barberia', category: 'Corte', duration_minutes: 35, price: 15, icon: 'scissors' },
      { id: 2, name: 'Corte clasico', category: 'Corte', duration_minutes: 35, price: 15, icon: 'scissors' },
      { id: 3, name: 'Corte escolar', category: 'Corte', duration_minutes: 30, price: 15, icon: 'scissors' },
      { id: 4, name: 'Corte + color', category: 'Color', duration_minutes: 90, price: 50, icon: 'paint' },
      { id: 5, name: 'Corte + semipermanente', category: 'Tratamientos', duration_minutes: 90, price: 50, icon: 'spark' },
      { id: 6, name: 'Corte + depilacion de cejas', category: 'Corte', duration_minutes: 45, price: 20, icon: 'razor' },
    ],
    employee_services: [
      ...[2,3,4,5].flatMap(eid => [1,2,3,4,5,6].map(sid => ({ employee_id: eid, service_id: sid })))
    ],
    schedules: (() => {
      const out = [];
      // Definimos el horario de atención exacto: de 10:00 AM a 5:00 PM (17:00)
      for (const eid of [2, 3, 4, 5]) {
        for (let d = 1; d <= 6; d++) out.push({ employee_id: eid, day_of_week: d, start_time: '10:00', end_time: '17:00' });
      }
      return out;
    })(),
    reservations: [],
    session: null,
    next_user_id: 6,
    next_reservation_id: 1,
  };
  save(s);
  // hash seed passwords in background; login() also accepts plaintext as fallback
  hashSeed(s).then(saved => save(saved));
  return s;
}

async function sha256(text) {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}
async function hashPassword(password, salt) {
  return sha256(salt + ':' + password);
}
async function hashSeed(s) {
  for (const u of s.users) {
    if (u.password && !u.password_hash) {
      u.salt = Math.random().toString(36).slice(2, 12);
      u.password_hash = await hashPassword(u.password, u.salt);
      delete u.password;
    }
  }
  save(s);
  return s;
}

// ---- public API ---------------------------------------------------------
const DB = {
  state() { return load() || seedIfEmpty(); },
  saveState(s) { save(s); },

  async register({ name, email, phone, age, password }) {
    const s = DB.state();
    email = String(email).toLowerCase();
    if (s.users.some(u => u.email === email)) throw new Error('Ya existe una cuenta con ese email.');
    const salt = Math.random().toString(36).slice(2, 12);
    const password_hash = await hashPassword(password, salt);
    const user = { id: s.next_user_id++, name, email, phone: phone || null, age: age || null, role: 'client', salt, password_hash };
    s.users.push(user);
    s.session = { user_id: user.id };
    save(s);
    return { id: user.id, name: user.name, email: user.email, role: user.role };
  },

  async login({ email, password, role }) {
    const s = DB.state();
    const u = s.users.find(u => u.email === String(email).toLowerCase());
    if (!u) throw new Error('Credenciales no válidas.');
    let ok = false;
    if (u.password && u.password === password) ok = true;          // seed plaintext fallback
    else if (u.salt && u.password_hash) {
      const h = await hashPassword(password, u.salt);
      ok = (h === u.password_hash);
    }
    if (!ok) throw new Error('Credenciales no válidas.');
    if (role && u.role !== role) {
      const labels = { admin: 'Administrador', employee: 'Trabajador', client: 'Cliente' };
      throw new Error(`Esta cuenta es de tipo "${labels[u.role] || u.role}", no "${labels[role] || role}".`);
    }
    s.session = { user_id: u.id };
    save(s);
    return { id: u.id, name: u.name, email: u.email, role: u.role };
  },

  employees() {
    return DB.state().users.filter(u => u.role === 'employee').map(u => ({ id: u.id, name: u.name }));
  },

  allReservations({ date, employee_id, status } = {}) {
    const s = DB.state();
    return s.reservations
      .filter(r => (!date || r.reserved_date === date)
                && (!employee_id || r.employee_id === employee_id)
                && (!status || r.status === status))
      .map(r => ({
        ...r,
        service: (s.services.find(x => x.id === r.service_id) || {}).name,
        employee: (s.users.find(u => u.id === r.employee_id) || {}).name,
        client: (s.users.find(u => u.id === r.client_id) || {}).name,
        client_phone: (s.users.find(u => u.id === r.client_id) || {}).phone,
      }))
      .sort((a, b) => (a.reserved_date + a.start_time).localeCompare(b.reserved_date + b.start_time));
  },

  logout() { const s = DB.state(); s.session = null; save(s); },

  me() {
    const s = DB.state();
    if (!s.session) return null;
    const u = s.users.find(u => u.id === s.session.user_id);
    if (!u) return null;
    return { id: u.id, name: u.name, email: u.email, role: u.role, phone: u.phone, age: u.age, commission_rate: u.commission_rate };
  },

  updateProfile({ name, phone, age }) {
    const s = DB.state();
    if (!s.session) throw new Error('No has iniciado sesión.');
    const u = s.users.find(u => u.id === s.session.user_id);
    if (!u) throw new Error('Usuario no encontrado.');
    if (name) u.name = name;
    if (phone !== undefined) u.phone = phone || null;
    if (age !== undefined) u.age = age ? Number(age) : null;
    save(s);
    return { id: u.id, name: u.name, email: u.email, role: u.role, phone: u.phone, age: u.age };
  },

upcomingForEmployee(employeeId) {
    const s = DB.state();
    const today = new Date().toISOString().slice(0, 10);
    return s.reservations
      // Quitamos 'completada' para que solo se queden las pendientes en la lista del trabajador
      .filter(r => r.employee_id === employeeId && r.reserved_date >= today && r.status === 'pendiente')
      .map(r => ({
        ...r,   
        service: (s.services.find(x => x.id === r.service_id) || {}).name,
        client: (s.users.find(u => u.id === r.client_id) || {}).name,
        client_phone: (s.users.find(u => u.id === r.client_id) || {}).phone,
      }))
      .sort((a, b) => (a.reserved_date + a.start_time).localeCompare(b.reserved_date + b.start_time));
  },

  services() { return DB.state().services; },

  employeesForService(serviceId) {
    const s = DB.state();
    const ids = s.employee_services.filter(x => x.service_id === serviceId).map(x => x.employee_id);
    return s.users.filter(u => u.role === 'employee' && ids.includes(u.id)).map(u => ({ id: u.id, name: u.name }));
  },

  availability({ employee_id, service_id, date }) {
    const s = DB.state();
    const svc = s.services.find(x => x.id === service_id);
    if (!svc) return { slots: [] };
    const dow = new Date(date + 'T00:00:00').getDay();
    const blocks = s.schedules.filter(x => x.employee_id === employee_id && x.day_of_week === dow);
    if (!blocks.length) return { slots: [] };
    const busy = s.reservations.filter(r => r.employee_id === employee_id && r.reserved_date === date && (r.status === 'pendiente' || r.status === 'completada'));
    const toMin = t => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };
    const pad = n => String(n).padStart(2, '0');
    const toHHMM = m => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
    const slots = [];
    const now = new Date();
    const isToday = date === now.toISOString().slice(0, 10);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    for (const b of blocks) {
      let cur = toMin(b.start_time);
      const end = toMin(b.end_time);
      while (cur + svc.duration_minutes <= end) {
        if (isToday && cur < nowMin) { cur += 15; continue; }
        const ss = cur, ee = cur + svc.duration_minutes;
        const overlaps = busy.some(r => !(ee <= toMin(r.start_time) || ss >= toMin(r.end_time)));
        if (!overlaps) slots.push(toHHMM(ss));
        
        // CAMBIO CRÍTICO: Avanzar exactamente los minutos que dura el servicio
        cur += svc.duration_minutes; 
      }
    }
    return { slots, duration: svc.duration_minutes };
  },

  createReservation({ employee_id, service_id, date, start_time }) {
    const s = DB.state();
    if (!s.session) throw new Error('Debes iniciar sesión.');
    const svc = s.services.find(x => x.id === service_id);
    if (!svc) throw new Error('Servicio no encontrado.');
    const toMin = t => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };
    const pad = n => String(n).padStart(2, '0');
    const startM = toMin(start_time);
    const endM = startM + svc.duration_minutes;
    const end_time = `${pad(Math.floor(endM / 60))}:${pad(endM % 60)}`;
    const conflict = s.reservations.some(r => r.employee_id === employee_id && r.reserved_date === date && (r.status === 'pendiente' || r.status === 'completada') && !(endM <= toMin(r.start_time) || startM >= toMin(r.end_time)));
    if (conflict) throw new Error('Ese horario ya no está disponible.');
    const code = (Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6)).toUpperCase();
    const rsv = {
      id: s.next_reservation_id++,
      code,
      client_id: s.session.user_id,
      employee_id, service_id,
      reserved_date: date,
      start_time, end_time,
      status: 'pendiente',
      payment_status: 'pagada',
      amount: svc.price,
      created_at: new Date().toISOString(),
    };
    s.reservations.push(rsv);
    save(s);
    return rsv;
  },

  myReservations() {
    const s = DB.state();
    if (!s.session) return [];
    return s.reservations
      .filter(r => r.client_id === s.session.user_id)
      .map(r => ({
        ...r,
        service: (s.services.find(x => x.id === r.service_id) || {}).name,
        employee: (s.users.find(u => u.id === r.employee_id) || {}).name,
      }))
      .sort((a, b) => (b.reserved_date + b.start_time).localeCompare(a.reserved_date + a.start_time));
  },

  agenda({ date, employee_id }) {
    const s = DB.state();
    const eid = employee_id || (s.session && s.session.user_id);
    return s.reservations
      .filter(r => r.employee_id === eid && r.reserved_date === date)
      .map(r => ({
        ...r,
        service: (s.services.find(x => x.id === r.service_id) || {}).name,
        client: (s.users.find(u => u.id === r.client_id) || {}).name,
        client_phone: (s.users.find(u => u.id === r.client_id) || {}).phone,
      }))
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  },

  updateReservationStatus(id, status) {
    const s = DB.state();
    const r = s.reservations.find(x => x.id === id);
    if (!r) return;
    r.status = status;
    save(s);
  },

  adminStats() {
    const s = DB.state();
    const month = new Date().toISOString().slice(0, 7);
    const inMonth = s.reservations.filter(r => r.reserved_date.startsWith(month) && (r.status === 'pendiente' || r.status === 'completada'));
    const totals = { reservations: inMonth.length, revenue: inMonth.reduce((a, r) => a + Number(r.amount), 0) };
    const byDayMap = {};
    inMonth.forEach(r => { byDayMap[r.reserved_date] = (byDayMap[r.reserved_date] || 0) + Number(r.amount); });
    const byDay = Object.keys(byDayMap).sort().map(d => ({ day: d, revenue: byDayMap[d] }));
    const svcMap = {};
    inMonth.forEach(r => { svcMap[r.service_id] = (svcMap[r.service_id] || 0) + 1; });
    const topServices = Object.entries(svcMap)
      .map(([sid, count]) => ({ name: (s.services.find(x => x.id === Number(sid)) || {}).name, count }))
      .sort((a, b) => b.count - a.count).slice(0, 10);
    const commissions = s.users.filter(u => u.role === 'employee').map(e => {
      const list = inMonth.filter(r => r.employee_id === e.id);
      const gross = list.reduce((a, r) => a + Number(r.amount), 0);
      const rate = Number(e.commission_rate || 30);
      return { id: e.id, name: e.name, reservations: list.length, gross, commission_rate: rate, commission: gross * rate / 100 };
    }).sort((a, b) => b.commission - a.commission);
    return { month, totals, byDay, topServices, commissions };
  },

  employeesCount() {
    return DB.state().users.filter(u => u.role === 'employee').length;
  }
};

// ---- DOM helpers --------------------------------------------------------
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function showError(target, msg) {
  let box = $('#form-error', target);
  if (!box) { box = document.createElement('div'); box.id = 'form-error'; box.className = 'form-error'; target.prepend(box); }
  box.textContent = msg; box.style.display = 'block';
}
function clearError(target) { const box = $('#form-error', target); if (box) box.style.display = 'none'; }

function avatarUrl(name, size = 96) {
  const n = encodeURIComponent(String(name || '?').trim() || '?');
  return `https://ui-avatars.com/api/?name=${n}&background=c9a24a&color=1a1407&bold=true&size=${size}&format=svg`;
}

// ---- Calendar widget ----------------------------------------------------
const MONTHS_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const DOWS_ES = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];

function ymd(d) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function makeCalendar(container, options) {
  // options: { initialDate, getDateCounts(year, month) -> {YYYY-MM-DD: count}, onSelect(dateStr) }
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayStr = ymd(today);
  let view = options.initialDate ? new Date(options.initialDate) : new Date();
  view.setDate(1);
  let selected = options.initialSelected || todayStr;

  function render() {
    const year = view.getFullYear();
    const month = view.getMonth();
    const counts = options.getDateCounts ? options.getDateCounts(year, month) : {};
    const first = new Date(year, month, 1);
    // Monday-first: getDay()=0 (Sun)..6 (Sat). We want offset where Mon=0
    let dow = first.getDay() - 1; if (dow < 0) dow = 6;
    const startDate = new Date(year, month, 1 - dow);

    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(startDate); d.setDate(startDate.getDate() + i);
      const ds = ymd(d);
      const other = d.getMonth() !== month;
      const isToday = ds === todayStr;
      const isSel = ds === selected;
      const count = counts[ds] || 0;
      const cls = ['cal-cell'];
      if (other) cls.push('other');
      if (isToday) cls.push('today');
      if (isSel && !other) cls.push('selected');
      if (count > 0 && !other) cls.push('has');
      cells.push(`<div class="${cls.join(' ')}" data-date="${ds}" ${other ? 'data-other="1"' : ''}>
        ${count > 0 && !other ? `<span class="cb">${count}</span>` : ''}
        <span class="cn">${d.getDate()}</span>
      </div>`);
    }

    container.innerHTML = `
      <div class="cal">
        <div class="cal-head">
          <div class="cal-title">${MONTHS_ES[month]} ${year}</div>
          <div class="cal-nav">
            <button type="button" data-act="prev" aria-label="Mes anterior">‹</button>
            <button type="button" data-act="today" title="Hoy" style="width:auto;padding:0 10px;font-size:13px">Hoy</button>
            <button type="button" data-act="next" aria-label="Mes siguiente">›</button>
          </div>
        </div>
        <div class="cal-dow">${DOWS_ES.map(d => `<div>${d}</div>`).join('')}</div>
        <div class="cal-grid">${cells.join('')}</div>
        <div class="cal-legend">
          <span class="leg"><span class="dot"></span> Con reservas</span>
          <span class="leg"><span class="ring"></span> Hoy</span>
        </div>
      </div>`;

    container.querySelector('[data-act="prev"]').onclick = () => { view.setMonth(view.getMonth() - 1); render(); };
    container.querySelector('[data-act="next"]').onclick = () => { view.setMonth(view.getMonth() + 1); render(); };
    container.querySelector('[data-act="today"]').onclick = () => { view = new Date(); view.setDate(1); selected = todayStr; render(); if (options.onSelect) options.onSelect(selected); };

    container.querySelectorAll('.cal-cell').forEach(cell => {
      cell.onclick = () => {
        if (cell.dataset.other) return;
        selected = cell.dataset.date;
        render();
        if (options.onSelect) options.onSelect(selected);
      };
    });
  }

  render();
  if (options.onSelect) options.onSelect(selected);

  return {
    refresh: render,
    getSelected: () => selected,
    select: (d) => { selected = d; render(); if (options.onSelect) options.onSelect(selected); },
  };
}

function renderNav() {
  const el = document.getElementById('nav-actions');
  if (!el) return;
  const user = DB.me();
  if (!user) {
    el.innerHTML = `
      <a class="navlink" href="login.html">Iniciar sesión</a>
      <a class="btn btn-primary btn-sm" href="register.html">Crear cuenta</a>`;
    return;
  }
  let mainLink = '';
  let secondary = '';
  if (user.role === 'admin') {
    mainLink = '<a class="navlink" href="admin.html">Panel</a>';
    secondary = '<a class="navlink" href="profile.html">Perfil</a>';
  } else if (user.role === 'employee') {
    mainLink = '<a class="navlink" href="dashboard.html">Mi agenda</a>';
    secondary = '<a class="navlink" href="profile.html">Perfil</a>';
  } else {
    mainLink = '<a class="navlink" href="mis-reservas.html">Mis reservas</a>';
    secondary = '<a class="navlink" href="book.html">Reservar</a>';
  }
  el.innerHTML = `
    <span class="who">Hola, ${escapeHtml(user.name)}</span>
    ${mainLink}
    ${secondary}
    <button class="btn btn-sm" id="logout-btn">Cerrar sesión</button>`;
  $('#logout-btn').onclick = () => { DB.logout(); location.href = 'index.html'; };
}

// init
seedIfEmpty();
document.addEventListener('DOMContentLoaded', renderNav);
