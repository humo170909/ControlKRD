/* ================================================
   script.js — KRD Importaciones v3 (CORREGIDO)
   ================================================ */

/* ══════════════════════════════════════════════
   1. USUARIOS
   ══════════════════════════════════════════════ */
const USERS = [
  { username: 'admin',    password: '5756784',   role: 'admin',    display: 'Administrador' },
  { username: 'MIXY',     password: 'Mixy2826',  role: 'employee', display: 'Mixy' },
  { username: 'JAIRO',    password: 'Jairo1726', role: 'employee', display: 'Jairo' },
];

const SUPABASE_URL = 'https://vbphssxbfuthmkcldnkb.supabase.co';
const SUPABASE_KEY = 'sb_publishable_abwXhuRC0foLsmBMwUso5g_ZCnhWmqS';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const SK_SESSION = 'krd_session';

function getSession() {
  try { return JSON.parse(sessionStorage.getItem(SK_SESSION)); } catch { return null; }
}
function setSession(user) {
  sessionStorage.setItem(SK_SESSION, JSON.stringify(user));
}
function clearSession() {
  sessionStorage.removeItem(SK_SESSION);
}
function isAdmin() {
  const s = getSession();
  return s && s.role === 'admin';
}

/* ══════════════════════════════════════════════
   2. AUDITORÍA
   ══════════════════════════════════════════════ */
async function getAudit() {
  const { data, error } = await supabaseClient.from('auditoria').select('*').order('fecha', { ascending: false }).limit(500);
  if (error) { console.error(error); return []; }
  return data || [];
}

async function audit(tipo, detalle) {
  const s = getSession();
  const entry = {
    fecha: new Date().toISOString(),
    usuario: s ? s.username : '—',
    rol: s ? s.role : '—',
    tipo,
    detalle
  };
  const { error } = await supabaseClient.from('auditoria').insert(entry);
  if (error) console.error('Audit error:', error);
}

async function renderAuditoria() {
  const lista = await getAudit();
  const tbody = document.getElementById('bodyAuditoria');
  const empty = document.getElementById('emptyAuditoria');
  if (!lista.length) { tbody.innerHTML = ''; empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');

  const claseMap  = { login: 'audit-login', logout: 'audit-logout', add: 'audit-add', delete: 'audit-delete', clear: 'audit-clear' };
  const labelMap  = { login: 'LOGIN', logout: 'LOGOUT', add: 'REGISTRO', delete: 'ELIMINACIÓN', clear: 'LIMPIEZA' };

  tbody.innerHTML = lista.map((e, i) => {
    const fecha = new Date(e.fecha).toLocaleString('es-PE');
    return `
      <tr>
        <td>${i + 1}</td>
        <td class="val-mono" style="font-size:0.75rem">${fecha}</td>
        <td>${e.usuario}</td>
        <td><span class="role-tag ${e.rol === 'employee' ? 'role-employee' : ''}">${e.rol === 'admin' ? 'Admin' : 'Colaborador'}</span></td>
        <td><span class="audit-action ${claseMap[e.tipo] || ''}">${labelMap[e.tipo] || e.tipo}</span></td>
        <td style="color:var(--text-secondary);font-size:0.8rem">${e.detalle}</td>
      </tr>`;
  }).join('');
}

/* ══════════════════════════════════════════════
   3. UTILIDADES
   ══════════════════════════════════════════════ */
function mostrarToast(msg, tipo = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast show toast-${tipo}`;
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 3200);
}

function fmt(n) {
  return 'S/ ' + Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
function fmtPct(v, t) {
  if (!t || t === 0) return '0%';
  return ((v / t) * 100).toFixed(1) + '%';
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}
function calcHoras(e, s) {
  if (!e || !s) return '—';
  const [hE, mE] = e.split(':').map(Number);
  const [hS, mS] = s.split(':').map(Number);
  let min = (hS * 60 + mS) - (hE * 60 + mE);
  if (min < 0) min += 1440;
  return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m`;
}
function setError(idMsg, input, msg) {
  document.getElementById(idMsg).textContent = msg;
  if (input) input.classList.add('input-error');
}
function clearErrors(ids, inputs = []) {
  ids.forEach(id => { const el = document.getElementById(id); if (el) el.textContent = ''; });
  inputs.forEach(i => i && i.classList.remove('input-error'));
}

/* ══════════════════════════════════════════════
   4. LOGIN / LOGOUT
   ══════════════════════════════════════════════ */
async function mostrarApp(session) {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('appScreen').classList.remove('hidden');

  document.getElementById('userBadgeName').textContent = session.display;
  const roleTag = document.getElementById('userRoleTag');
  // CAMBIO: "Empleado" → "Colaborador"
  roleTag.textContent = session.role === 'admin' ? 'Admin' : 'Colaborador';
  roleTag.className = `role-tag ${session.role === 'employee' ? 'role-employee' : ''}`;

  document.querySelectorAll('.tab-admin-only').forEach(el => {
    el.classList.toggle('hidden', !isAdmin());
  });
  document.querySelectorAll('.admin-only').forEach(el => {
    el.classList.toggle('hidden', !isAdmin());
  });
  document.querySelectorAll('th.admin-only, td.admin-only').forEach(el => {
    el.classList.toggle('hidden', !isAdmin());
  });

  document.getElementById('headerDate').textContent =
    new Date().toLocaleDateString('es-PE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  await renderAsistencia();
  toggleAsistenciaMode();
  await renderSelectMeses();
  await renderVentas();
  actualizarPreview();
  await renderSelectMesesDescargas();
  updateFieldPermissions();
}

function mostrarLogin() {
  document.getElementById('appScreen').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
}

document.getElementById('formLogin').addEventListener('submit', async function (e) {
  e.preventDefault();
  const user = document.getElementById('loginUser');
  const pass = document.getElementById('loginPass');
  const errorBox = document.getElementById('loginErrorBox');

  clearErrors(['err-loginUser', 'err-loginPass'], [user, pass]);
  errorBox.textContent = '';
  errorBox.classList.remove('show');

  let ok = true;
  if (!user.value.trim()) { setError('err-loginUser', user, 'Ingresa tu usuario.'); ok = false; }
  if (!pass.value)        { setError('err-loginPass', pass, 'Ingresa tu contraseña.'); ok = false; }
  if (!ok) return;

  const found = USERS.find(
    u => u.username === user.value.trim() && u.password === pass.value
  );

  if (!found) {
    errorBox.textContent = 'Usuario o contraseña incorrectos. Verifica tus datos.';
    errorBox.classList.add('show');
    pass.value = '';
    pass.focus();
    return;
  }

  const session = { username: found.username, role: found.role, display: found.display };
  setSession(session);
  await audit('login', `Inicio de sesión como ${found.display}`);
  await mostrarApp(session);
  this.reset();
});

document.getElementById('btnLogout').addEventListener('click', async () => {
  await audit('logout', `Cierre de sesión de ${getSession()?.display}`);
  clearSession();
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelector('[data-tab="asistencia"]').classList.add('active');
  document.getElementById('tab-asistencia').classList.add('active');
  mostrarLogin();
  mostrarToast('Sesión cerrada.', 'info');
});

document.getElementById('togglePass').addEventListener('click', () => {
  const inp = document.getElementById('loginPass');
  inp.type = inp.type === 'password' ? 'text' : 'password';
});

/* ══════════════════════════════════════════════
   PESTAÑAS
   ══════════════════════════════════════════════ */
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab)?.classList.add('active');
    if (btn.dataset.tab === 'auditoria') renderAuditoria();
  });
});

/* ══════════════════════════════════════════════
   5. ASISTENCIA
   ══════════════════════════════════════════════ */
async function getAsistencias() {
  const hoy = new Date().toISOString().split('T')[0];
  const { data, error } = await supabaseClient.from('asistencia').select('*').eq('fecha', hoy);
  if (error) { console.error(error); return []; }
  return data || [];
}

async function saveAsistencias(arr) {
  const hoy = new Date().toISOString().split('T')[0];
  const { error: delError } = await supabaseClient.from('asistencia').delete().eq('fecha', hoy);
  if (delError) console.error(delError);
  if (arr.length > 0) {
    const { error } = await supabaseClient.from('asistencia').insert(arr);
    if (error) console.error(error);
  }
}

async function renderAsistencia() {
  const lista = await getAsistencias();
  const tbody = document.getElementById('bodyAsistencia');
  const empty = document.getElementById('emptyAsistencia');
  document.getElementById('totalAsistencias').textContent =
    `${lista.length} trabajador${lista.length !== 1 ? 'es' : ''} registrado${lista.length !== 1 ? 's' : ''}`;

  if (!lista.length) { tbody.innerHTML = ''; empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');

  tbody.innerHTML = lista.map((r, i) => `
    <tr class="${i === lista.length - 1 ? 'row-new' : ''}">
      <td>${i + 1}</td>
      <td>${r.nombre}</td>
      <td class="val-mono">${r.entrada}</td>
      <td class="val-mono">${r.salida || '<span style="color:var(--text-muted)">—</span>'}</td>
      <td class="val-mono">${calcHoras(r.entrada, r.salida)}</td>
      <td><span class="reg-by">${r.registrado_por || '—'}</span></td>
      ${isAdmin() ? `<td><button class="btn-delete" onclick="delAsistencia('${r.id}')">✕</button></td>` : '<td></td>'}
    </tr>`).join('');
}

async function delAsistencia(id) {
  if (!isAdmin()) return;
  const lista = await getAsistencias();
  const reg = lista.find(r => r.id === id);
  const nuevaLista = lista.filter(r => r.id !== id);
  await saveAsistencias(nuevaLista);
  await audit('delete', `Asistencia eliminada: ${reg?.nombre}`);
  await renderAsistencia();
  mostrarToast('Registro eliminado.', 'info');
}

document.querySelectorAll('input[name="accionAsistencia"]').forEach(r => r.addEventListener('change', toggleAsistenciaMode));

function toggleAsistenciaMode() {
  const isEntrada = document.querySelector('input[name="accionAsistencia"]:checked').value === 'entrada';
  document.getElementById('groupSelectSalida').style.display = isEntrada ? 'none' : 'block';
  document.getElementById('nombreTrabajador').parentElement.style.display = isEntrada ? 'block' : 'none';
  document.getElementById('horaEntrada').parentElement.style.display = isEntrada ? 'block' : 'none';
  document.getElementById('horaSalida').parentElement.style.display = 'block';
  if (!isEntrada) populateSelectSalida();
}

async function populateSelectSalida() {
  const select = document.getElementById('selectTrabajadorSalida');
  const lista = await getAsistencias();
  const filtered = lista.filter(r => r.entrada && !r.salida);
  select.innerHTML = '<option value="">— Selecciona —</option>' + filtered.map(r => `<option value="${r.id}">${r.nombre}</option>`).join('');
}

document.getElementById('formAsistencia').addEventListener('submit', async function (e) {
  e.preventDefault();
  const accion = document.querySelector('input[name="accionAsistencia"]:checked').value;
  if (accion === 'entrada') {
    const nom = document.getElementById('nombreTrabajador');
    const ent = document.getElementById('horaEntrada');
    const sal = document.getElementById('horaSalida');
    clearErrors(['err-nombre', 'err-entrada', 'err-salida'], [nom, ent, sal]);

    let ok = true;
    if (!nom.value.trim() || nom.value.trim().length < 3)
      { setError('err-nombre', nom, 'Mínimo 3 caracteres.'); ok = false; }
    if (!ent.value)
      { setError('err-entrada', ent, 'Ingresa la hora de entrada.'); ok = false; }
    if (sal.value && sal.value === ent.value)
      { setError('err-salida', sal, 'Salida no puede ser igual a entrada.'); ok = false; }
    if (!ok) return;

    const s = getSession();
    const hoy = new Date().toISOString().split('T')[0];
    const nuevo = { nombre: nom.value.trim(), entrada: ent.value, salida: sal.value || null, registrado_por: s?.display || '—', fecha: hoy };
    const lista = await getAsistencias();
    lista.push(nuevo);
    await saveAsistencias(lista);
    await audit('add', `Asistencia registrada: ${nuevo.nombre} (${nuevo.entrada}–${nuevo.salida || 'sin salida'})`);
    await renderAsistencia();
    mostrarToast(`✓ Asistencia de ${nuevo.nombre} registrada.`);
    this.reset();
    toggleAsistenciaMode();
  } else {
    const select = document.getElementById('selectTrabajadorSalida');
    const sal = document.getElementById('horaSalida');
    clearErrors(['err-select', 'err-salida'], [select, sal]);

    let ok = true;
    if (!select.value) { setError('err-select', select, 'Selecciona un trabajador.'); ok = false; }
    if (!sal.value)    { setError('err-salida', sal, 'Ingresa la hora de salida.'); ok = false; }
    if (!ok) return;

    const lista = await getAsistencias();
    const reg = lista.find(r => r.id === select.value);
    if (!reg) return;
    if (sal.value === reg.entrada) { setError('err-salida', sal, 'Salida no puede ser igual a entrada.'); return; }
    reg.salida = sal.value;
    await saveAsistencias(lista);
    await audit('add', `Salida registrada: ${reg.nombre} (${reg.salida})`);
    await renderAsistencia();
    mostrarToast(`✓ Salida de ${reg.nombre} registrada.`);
    this.reset();
    toggleAsistenciaMode();
  }
});

document.getElementById('clearAsistencia').addEventListener('click', async () => {
  if (!isAdmin()) return;
  if (confirm('¿Eliminar todos los registros de asistencia?')) {
    await audit('clear', 'Todos los registros de asistencia eliminados');
    const hoy = new Date().toISOString().split('T')[0];
    const { error } = await supabaseClient.from('asistencia').delete().eq('fecha', hoy);
    if (error) console.error(error);
    await renderAsistencia();
    mostrarToast('Registros eliminados.', 'info');
  }
});

/* ══════════════════════════════════════════════
   6. VENTAS POR MES
   ══════════════════════════════════════════════ */
async function getMeses() {
  const { data, error } = await supabaseClient.from('meses').select('*');
  if (error) { console.error(error); return []; }
  return data || [];
}

async function saveMeses(arr) {
  const { error: delError } = await supabaseClient.from('meses').delete().neq('id', 'dummy');
  if (delError) console.error(delError);
  if (arr.length > 0) {
    const { error } = await supabaseClient.from('meses').insert(arr);
    if (error) console.error(error);
  }
}

async function getDias(mesId) {
  const { data, error } = await supabaseClient.from('dias').select('*').eq('mes_id', mesId);
  if (error) { console.error(error); return []; }
  return data || [];
}

async function saveDias(mesId, arr) {
  const { error: delError } = await supabaseClient.from('dias').delete().eq('mes_id', mesId);
  if (delError) console.error(delError);
  if (arr.length > 0) {
    const { error } = await supabaseClient.from('dias').insert(arr.map(d => ({ ...d, mes_id: mesId })));
    if (error) console.error(error);
  }
}

function getMesActivo() { return document.getElementById('mesSelector').value; }

async function renderSelectMeses() {
  const sel = document.getElementById('mesSelector');
  const prev = sel.value;
  const meses = await getMeses();
  sel.innerHTML = meses.length
    ? meses.map(m => `<option value="${m.id}">${m.nombre}</option>`).join('')
    : '<option value="">— Sin meses creados —</option>';
  if (prev && meses.find(m => m.id === prev)) sel.value = prev;
}

async function renderVentas() {
  const mesId = getMesActivo();
  const meses = await getMeses();
  const mes = meses.find(m => m.id === mesId);
  document.getElementById('labelMesActual').textContent =
    mes ? `DÍAS REGISTRADOS — ${mes.nombre.toUpperCase()}` : 'DÍAS REGISTRADOS';

  const lista = mesId ? await getDias(mesId) : [];
  const tbody = document.getElementById('bodyVentas');
  const empty = document.getElementById('emptyVentas');

  if (!lista.length) {
    tbody.innerHTML = ''; empty.classList.remove('hidden');
    actualizarReporte([]); return;
  }
  empty.classList.add('hidden');

  const sorted = [...lista].sort((a, b) => a.fecha.localeCompare(b.fecha));

  tbody.innerHTML = sorted.map((d, i) => {
    const totalBruto = (d.efectivo || 0) + (d.yape || 0) + (d.plin || 0);
    const gastos = d.transf || 0;
    const totalNeto = totalBruto - gastos;
    const ganancia = d.ganancia || 0;
    const balance = totalNeto - ganancia;
    const clsGan = ganancia >= 0 ? 'val-ganancia' : 'val-negativo';
    const pctGan = fmtPct(ganancia, totalNeto);
    const fechaFmt = new Date(d.fecha + 'T12:00:00').toLocaleDateString('es-PE',
      { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });

    return `
      <tr class="${i === lista.length - 1 ? 'row-new' : ''}">
        <td>${i + 1}</td>
        <td>${fechaFmt}</td>
        <td class="val-mono" style="color:#10b981">${fmt(d.efectivo || 0)}</td>
        <td class="val-mono val-yape">${fmt(d.yape || 0)}</td>
        <td class="val-mono val-plin">${fmt(d.plin || 0)}</td>
        <td class="val-mono val-transf" style="color:#ef4444">${fmt(gastos)}</td>
        <td class="val-mono val-accent">${fmt(totalBruto)}</td>
        <td class="val-mono val-accent">${fmt(totalNeto)}</td>
        <td class="val-mono ${clsGan}">${fmt(ganancia)}</td>
        <td class="val-mono" style="color:#8892b0">${fmt(balance)}</td>
        <td class="val-mono" style="color:var(--text-secondary)">${pctGan}</td>
        <td><span class="reg-by">${d.registrado_por || '—'}</span></td>
        ${isAdmin() ? `<td><button class="btn-delete" onclick="delDia('${mesId}','${d.id}')">✕</button></td>` : '<td></td>'}
      </tr>`;
  }).join('');

  actualizarReporte(lista);
}

function actualizarReporte(lista) {
  const totalE = lista.reduce((a, d) => a + (d.efectivo || 0), 0);
  const totalY = lista.reduce((a, d) => a + (d.yape || 0), 0);
  const totalP = lista.reduce((a, d) => a + (d.plin || 0), 0);
  const totalT = lista.reduce((a, d) => a + (d.transf || 0), 0);
  const totalBruto = totalE + totalY + totalP;
  const totalNeto = totalBruto - totalT;
  const totalG = lista.reduce((a, d) => a + (d.ganancia || 0), 0);
  const totalB = totalNeto - totalG;

  document.getElementById('reporteEfectivo').textContent      = fmt(totalE);
  document.getElementById('reporteYape').textContent          = fmt(totalY);
  document.getElementById('reportePlin').textContent          = fmt(totalP);
  document.getElementById('reporteTransf').textContent        = fmt(totalT);
  document.getElementById('reporteTotalBruto').textContent    = fmt(totalBruto);
  document.getElementById('reporteTotalVentas').textContent   = fmt(totalNeto);
  document.getElementById('reporteCostoTotal').textContent    = fmt(totalG);
  document.getElementById('reporteGananciaTotal').textContent = fmt(totalB);
  document.getElementById('reporteDias').textContent          = lista.length;

  document.getElementById('reporteGananciaTotal').style.color =
    totalB >= 0 ? 'var(--success)' : 'var(--danger)';
}

async function delDia(mesId, id) {
  if (!isAdmin()) return;
  const lista = await getDias(mesId);
  const reg = lista.find(d => d.id === id);
  const nuevaLista = lista.filter(d => d.id !== id);
  await saveDias(mesId, nuevaLista);
  const totalBruto = (reg?.efectivo || 0) + (reg?.yape || 0) + (reg?.plin || 0);
  const gastos = reg?.transf || 0;
  const totalNeto = totalBruto - gastos;
  await audit('delete', `Día eliminado: ${reg?.fecha} — Total neto: ${fmt(totalNeto)}`);
  await renderVentas();
  await renderSelectMesesDescargas();
  mostrarToast('Día eliminado.', 'info');
}

/* ── Preview en tiempo real ── */
function actualizarPreview() {
  const e = parseFloat(document.getElementById('ventaEfectivo').value) || 0;
  const y = parseFloat(document.getElementById('ventaYape').value) || 0;
  const p = parseFloat(document.getElementById('ventaPlin').value) || 0;
  const t = parseFloat(document.getElementById('ventaTransf').value) || 0;
  const g = parseFloat(document.getElementById('gananciaDelDia').value) || 0;

  const totalBruto = e + y + p;
  const totalNeto  = totalBruto - t;
  const balance    = totalNeto - g;

  document.getElementById('previewEfectivo').textContent  = fmt(e);
  document.getElementById('previewYapeVal').textContent   = fmt(y);
  document.getElementById('previewPlinVal').textContent   = fmt(p);
  document.getElementById('previewTransfVal').textContent = fmt(t);
  document.getElementById('previewTotalBruto').textContent = fmt(totalBruto);
  document.getElementById('previewTotal').textContent     = fmt(totalNeto);
  document.getElementById('previewGanancia').textContent  = fmt(g);
  document.getElementById('previewBalance').textContent   = fmt(balance);
  document.getElementById('previewGanancia').style.color  =
    g >= 0 ? 'var(--accent-light)' : 'var(--danger)';
}

['ventaEfectivo', 'ventaYape', 'ventaPlin', 'ventaTransf', 'gananciaDelDia'].forEach(id =>
  document.getElementById(id).addEventListener('input', actualizarPreview));

/* ── Guardar día ── */
document.getElementById('formVentas').addEventListener('submit', async function (e) {
  e.preventDefault();
  const fec      = document.getElementById('fechaVenta');
  const efectivo = document.getElementById('ventaEfectivo');
  const yape     = document.getElementById('ventaYape');
  const plin     = document.getElementById('ventaPlin');
  const transf   = document.getElementById('ventaTransf');
  const ganancia = document.getElementById('gananciaDelDia');

  clearErrors(
    ['err-fecha', 'err-efectivo', 'err-yape', 'err-plin', 'err-transf', 'err-ganancia'],
    [fec, efectivo, yape, plin, transf, ganancia]
  );

  const mesId = getMesActivo();
  if (!mesId) { mostrarToast('Crea un mes primero.', 'error'); return; }

  let ok = true;
  if (!fec.value) { setError('err-fecha', fec, 'Selecciona una fecha.'); ok = false; }

  const eNum = parseFloat(efectivo.value) || 0;
  const yNum = parseFloat(yape.value)     || 0;
  const pNum = parseFloat(plin.value)     || 0;
  const tNum = parseFloat(transf.value)   || 0;
  const gNum = parseFloat(ganancia.value) || 0;

  if (eNum === 0 && yNum === 0 && pNum === 0) {
    setError('err-efectivo', efectivo, 'Ingresa al menos un monto de venta.');
    ok = false;
  }
  if (gNum < 0) { setError('err-ganancia', ganancia, 'La ganancia no puede ser negativa.'); ok = false; }
  if (!ok) return;

  const lista   = await getDias(mesId);
  const existe  = lista.find(d => d.fecha === fec.value);

  if (existe) {
    if (!isAdmin()) {
      mostrarToast('Ya existe un registro para esa fecha. Solo el administrador puede modificarlo.', 'error');
      return;
    }
    if (!confirm(`Ya existe un registro para ${fec.value}. ¿Deseas sobreescribirlo?`)) return;
    existe.efectivo      = eNum;
    existe.yape          = yNum;
    existe.plin          = pNum;
    existe.transf        = tNum;
    existe.ganancia      = gNum;
    existe.registrado_por = getSession()?.display || '—';
    await saveDias(mesId, lista);
    const tb = eNum + yNum + pNum;
    const tn = tb - tNum;
    await audit('add', `Día sobreescrito: ${fec.value} — Efectivo:${fmt(eNum)} Yape:${fmt(yNum)} Plin:${fmt(pNum)} Gastos:${fmt(tNum)} Total bruto:${fmt(tb)} Total neto:${fmt(tn)} Ganancia:${fmt(gNum)}`);
  } else {
    const s  = getSession();
    const tb = eNum + yNum + pNum;
    const tn = tb - tNum;
    lista.push({
      fecha: fec.value,
      efectivo: eNum, yape: yNum, plin: pNum, transf: tNum, ganancia: gNum,
      registrado_por: s?.display || '—'
    });
    await saveDias(mesId, lista);
    await audit('add', `Día registrado: ${fec.value} — Efectivo:${fmt(eNum)} Yape:${fmt(yNum)} Plin:${fmt(pNum)} Gastos:${fmt(tNum)} Total bruto:${fmt(tb)} Total neto:${fmt(tn)} Ganancia:${fmt(gNum)}`);
  }

  await renderVentas();
  await renderSelectMesesDescargas();
  mostrarToast('✓ Día guardado correctamente.');
  this.reset();
  actualizarPreview();
  const hoy = new Date();
  document.getElementById('fechaVenta').value =
    `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-${String(hoy.getDate()).padStart(2,'0')}`;
});

/* ── Limpiar mes ── */
document.getElementById('clearDia').addEventListener('click', async () => {
  if (!isAdmin()) return;
  const mesId = getMesActivo();
  if (!mesId) { mostrarToast('No hay mes seleccionado.', 'error'); return; }
  const meses = await getMeses();
  const mes = meses.find(m => m.id === mesId);
  if (confirm(`¿Eliminar todos los días del mes "${mes?.nombre}"?`)) {
    await audit('clear', `Mes limpiado: ${mes?.nombre}`);
    const { error } = await supabaseClient.from('dias').delete().eq('mes_id', mesId);
    if (error) console.error(error);
    await renderVentas();
    await renderSelectMesesDescargas();
    mostrarToast('Mes limpiado.', 'info');
  }
});

document.getElementById('mesSelector').addEventListener('change', async () => {
  await renderVentas();
  await renderSelectMesesDescargas();
});

document.getElementById('clearAuditoria').addEventListener('click', async () => {
  if (confirm('¿Eliminar todo el historial de auditoría?')) {
    await audit('clear', 'Historial de auditoría limpiado');
    const { error } = await supabaseClient.from('auditoria').delete().neq('id', 'dummy');
    if (error) console.error(error);
    await renderAuditoria();
    mostrarToast('Historial limpiado.', 'info');
  }
});

/* ══════════════════════════════════════════════
   MODAL — NUEVO MES
   ══════════════════════════════════════════════ */
const overlay  = document.getElementById('modalOverlay');
const inputMes = document.getElementById('inputNuevoMes');

document.getElementById('btnNuevoMes').addEventListener('click', () => {
  inputMes.value = '';
  document.getElementById('err-mes').textContent = '';
  inputMes.classList.remove('input-error');
  overlay.classList.add('active');
  setTimeout(() => inputMes.focus(), 80);
});

document.getElementById('modalCancelar').addEventListener('click', () => overlay.classList.remove('active'));
overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('active'); });

document.getElementById('modalConfirmar').addEventListener('click', async () => {
  const nombre = inputMes.value.trim();
  const errEl  = document.getElementById('err-mes');
  inputMes.classList.remove('input-error'); errEl.textContent = '';

  if (!nombre || nombre.length < 2) {
    errEl.textContent = 'Mínimo 2 caracteres.'; inputMes.classList.add('input-error'); return;
  }
  const meses = await getMeses();
  if (meses.find(m => m.nombre.toLowerCase() === nombre.toLowerCase())) {
    errEl.textContent = 'Ya existe un mes con ese nombre.'; inputMes.classList.add('input-error'); return;
  }

  const nuevoMes = { id: uid(), nombre };
  meses.push(nuevoMes);
  await saveMeses(meses);
  await renderSelectMeses();
  await renderSelectMesesDescargas();
  document.getElementById('mesSelector').value = nuevoMes.id;
  await renderVentas();
  await audit('add', `Nuevo mes creado: ${nombre}`);
  overlay.classList.remove('active');
  mostrarToast(`✓ Mes "${nombre}" creado.`);
});

inputMes.addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('modalConfirmar').click(); });

/* ══════════════════════════════════════════════
   7. PERMISOS
   ══════════════════════════════════════════════ */
function updateFieldPermissions() {
  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.style.display = isAdmin() ? 'inline-flex' : 'none';
  });
}

/* ══════════════════════════════════════════════
   8. DESCARGAS — Exportar a Excel real con SheetJS
   ══════════════════════════════════════════════ */

/**
 * Genera un archivo .xlsx real usando SheetJS (xlsx CDN).
 * @param {string} filename  - nombre sin extensión
 * @param {string} sheetName - nombre de la hoja
 * @param {string[]} headers - cabeceras
 * @param {Array[]}  rows    - filas de datos
 */
function exportarExcel(filename, sheetName, headers, rows) {
  // SheetJS debe estar cargado via CDN en el HTML
  if (typeof XLSX === 'undefined') {
    mostrarToast('Error: librería Excel no cargada.', 'error');
    console.error('SheetJS (XLSX) no está disponible. Agrega el CDN en el HTML.');
    return;
  }

  // Construir matriz: cabeceras + filas
  const wsData = [headers, ...rows];

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Ancho automático de columnas
  const colWidths = headers.map((h, i) => {
    const maxLen = Math.max(
      String(h).length,
      ...rows.map(r => String(r[i] ?? '').length)
    );
    return { wch: Math.min(maxLen + 4, 40) };
  });
  ws['!cols'] = colWidths;

  // Estilo de cabecera (negrita) — solo si SheetJS Pro; en free se ignora
  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let C = range.s.c; C <= range.e.c; C++) {
    const cellAddr = XLSX.utils.encode_cell({ r: 0, c: C });
    if (!ws[cellAddr]) continue;
    ws[cellAddr].s = { font: { bold: true } };
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));

  XLSX.writeFile(wb, filename + '.xlsx');
}

async function renderSelectMesesDescargas() {
  const sel = document.getElementById('selectMesVentasDescargas');
  const meses = await getMeses();
  sel.innerHTML = meses.length
    ? meses.map(m => `<option value="${m.id}">${m.nombre}</option>`).join('')
    : '<option value="">— Sin meses creados —</option>';
  if (meses.length > 0) sel.value = meses[meses.length - 1].id;
}

/* ── Descargar ventas ── */
document.getElementById('btnDescargarVentas').addEventListener('click', async () => {
  const mesId = document.getElementById('selectMesVentasDescargas').value;
  if (!mesId) { mostrarToast('Selecciona un mes para descargar.', 'error'); return; }

  const meses = await getMeses();
  const mes   = meses.find(m => m.id === mesId);
  const dias  = await getDias(mesId);

  if (!dias.length) { mostrarToast('No hay datos en este mes.', 'info'); return; }

  const headers = [
    'Fecha', 'Día',
    'Efectivo (S/)', 'Yape (S/)', 'Plin (S/)', 'Gastos (S/)',
    'Total Bruto (S/)', 'Total Neto (S/)',
    'Ganancia Realizada (S/)', 'Balance Restante (S/)',
    'Margen %', 'Registrado por'
  ];

  const rows = [];
  const sorted = [...dias].sort((a, b) => a.fecha.localeCompare(b.fecha));

  sorted.forEach(d => {
    const bruto   = (d.efectivo || 0) + (d.yape || 0) + (d.plin || 0);
    const neto    = bruto - (d.transf || 0);
    const gan     = d.ganancia || 0;
    const balance = neto - gan;
    const margen  = neto > 0 ? ((gan / neto) * 100).toFixed(1) + '%' : '0%';
    const fecha   = new Date(d.fecha + 'T12:00:00');
    const dia     = fecha.toLocaleDateString('es-PE', { weekday: 'short' }).toUpperCase();

    rows.push([
      d.fecha, dia,
      +(d.efectivo || 0).toFixed(2),
      +(d.yape  || 0).toFixed(2),
      +(d.plin  || 0).toFixed(2),
      +(d.transf || 0).toFixed(2),
      +bruto.toFixed(2),
      +neto.toFixed(2),
      +gan.toFixed(2),
      +balance.toFixed(2),
      margen,
      d.registrado_por || '—'
    ]);
  });

  // Fila de totales
  const totalE     = dias.reduce((a, d) => a + (d.efectivo || 0), 0);
  const totalY     = dias.reduce((a, d) => a + (d.yape     || 0), 0);
  const totalP     = dias.reduce((a, d) => a + (d.plin     || 0), 0);
  const totalT     = dias.reduce((a, d) => a + (d.transf   || 0), 0);
  const totalBruto = totalE + totalY + totalP;
  const totalNeto  = totalBruto - totalT;
  const totalG     = dias.reduce((a, d) => a + (d.ganancia || 0), 0);
  const totalB     = totalNeto - totalG;

  rows.push([]); // fila vacía separadora
  rows.push([
    'TOTAL', '',
    +totalE.toFixed(2), +totalY.toFixed(2), +totalP.toFixed(2), +totalT.toFixed(2),
    +totalBruto.toFixed(2), +totalNeto.toFixed(2),
    +totalG.toFixed(2), +totalB.toFixed(2),
    totalNeto > 0 ? ((totalG / totalNeto) * 100).toFixed(1) + '%' : '0%',
    ''
  ]);

  const fecha = new Date();
  const nombreArchivo = `Ventas_${mes.nombre}_${fecha.getFullYear()}-${String(fecha.getMonth()+1).padStart(2,'0')}-${String(fecha.getDate()).padStart(2,'0')}`;
  exportarExcel(nombreArchivo, mes.nombre, headers, rows);
  mostrarToast('✓ Ventas descargadas.', 'success');
});

/* ── Descargar asistencias ── */
document.getElementById('btnDescargarAsistencias').addEventListener('click', async () => {
  const asistencias = await getAsistencias();

  if (!asistencias.length) { mostrarToast('No hay asistencias para descargar.', 'info'); return; }

  const headers = ['#', 'Trabajador', 'Hora Entrada', 'Hora Salida', 'Duración', 'Registrado por'];

  const rows = asistencias
    .sort((a, b) => {
      if (a.entrada !== b.entrada) return a.entrada.localeCompare(b.entrada);
      return a.nombre.localeCompare(b.nombre);
    })
    .map((r, i) => [
      i + 1,
      r.nombre,
      r.entrada,
      r.salida || '—',
      calcHoras(r.entrada, r.salida),
      r.registrado_por || '—'
    ]);

  const fecha = new Date();
  const nombreArchivo = `Asistencias_${fecha.getFullYear()}-${String(fecha.getMonth()+1).padStart(2,'0')}-${String(fecha.getDate()).padStart(2,'0')}`;
  exportarExcel(nombreArchivo, 'Asistencias', headers, rows);
  mostrarToast('✓ Asistencias descargadas.', 'success');
});

/* ══════════════════════════════════════════════
   INIT
   ══════════════════════════════════════════════ */
(async function init() {
  const session = getSession();
  if (session) {
    await mostrarApp(session);
  } else {
    mostrarLogin();
  }

  const hoy = new Date();
  const ymd = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-${String(hoy.getDate()).padStart(2,'0')}`;
  document.getElementById('fechaVenta').value = ymd;
})();
