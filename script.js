/* ================================================
   script.js — KRD Importaciones v6 FINAL
   ================================================
   ⚠️  SOLO DEBES CAMBIAR ESTAS 2 LÍNEAS:
   
   SUPABASE_URL  → tu URL (ya está correcta)
   SUPABASE_KEY  → ve a Supabase → Settings → API Keys
                   → pestaña "Legacy anon, service_role API keys"
                   → copia la clave "anon" (empieza con eyJ...)
   ================================================ */

const SUPABASE_URL = 'https://vbphssxbfuthmkcldnkb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZicGhzc3hiZnV0aG1rY2xkbmtiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NTMzMjIsImV4cCI6MjA5MDEyOTMyMn0.FHbdMKMWT9V2tf-Z0KGbZtKxcM1c30gX7GeRWXdvq10';
/* 
   CÓMO OBTENER TU KEY:
   1. Abre Supabase → tu proyecto
   2. Settings → API Keys
   3. Haz clic en la pestaña: "Legacy anon, service_role API keys"
   4. Copia el valor de "anon" (empieza con eyJhbGci...)
   5. Pégalo arriba reemplazando TU_LEGACY_ANON_KEY_AQUI
*/

/* ══════════════════════════════════════════════
   USUARIOS (autenticación local, sin Supabase Auth)
   ══════════════════════════════════════════════ */
const USERS = [
  { username: 'admin',  password: '5756784',   role: 'admin',    display: 'Administrador' },
  { username: 'MIXY',   password: 'Mixy2826',  role: 'employee', display: 'Mixy' },
  { username: 'JAIRO',  password: 'Jairo1726', role: 'employee', display: 'Jairo' },
];

/* ══════════════════════════════════════════════
   INICIALIZAR SUPABASE
   ══════════════════════════════════════════════ */
let sb;
try {
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
} catch (e) {
  console.error('Error Supabase init:', e);
}

/* ══════════════════════════════════════════════
   SESIÓN
   ══════════════════════════════════════════════ */
const SK = 'krd_v6';
const getSession  = () => { try { return JSON.parse(sessionStorage.getItem(SK)); } catch { return null; } };
const setSession  = u  => sessionStorage.setItem(SK, JSON.stringify(u));
const clearSession= () => sessionStorage.removeItem(SK);
const isAdmin     = () => { const s = getSession(); return s && s.role === 'admin'; };

/* ══════════════════════════════════════════════
   UTILIDADES
   ══════════════════════════════════════════════ */
function mostrarToast(msg, tipo = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast show toast-${tipo}`;
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 3200);
}

function fmt(n) {
  return 'S/ ' + Number(n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
function fmtPct(v, t) {
  return (!t || t === 0) ? '0%' : ((v / t) * 100).toFixed(1) + '%';
}
function calcHoras(e, s) {
  if (!e || !s) return '—';
  const [hE, mE] = e.split(':').map(Number);
  const [hS, mS] = s.split(':').map(Number);
  let min = (hS * 60 + mS) - (hE * 60 + mE);
  if (min < 0) min += 1440;
  return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m`;
}
function setError(id, input, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg;
  if (input) input.classList.add('input-error');
}
function clearErrors(ids, inputs = []) {
  ids.forEach(id => { const el = document.getElementById(id); if (el) el.textContent = ''; });
  inputs.forEach(i => i && i.classList.remove('input-error'));
}
function logErr(ctx, err) {
  console.error(`[KRD:${ctx}]`, err?.message || err, err);
}

/* ══════════════════════════════════════════════
   AUDITORÍA
   ══════════════════════════════════════════════ */
async function getAudit() {
  const { data, error } = await sb.from('auditoria').select('*').order('fecha', { ascending: false }).limit(500);
  if (error) { logErr('getAudit', error); return []; }
  return data || [];
}

async function audit(tipo, detalle) {
  const s = getSession();
  const { error } = await sb.from('auditoria').insert({
    fecha:   new Date().toISOString(),
    usuario: s?.username || '—',
    rol:     s?.role || '—',
    tipo, detalle
  });
  if (error) logErr('audit.insert', error);
}

async function renderAuditoria() {
  const lista = await getAudit();
  const tbody = document.getElementById('bodyAuditoria');
  const empty = document.getElementById('emptyAuditoria');
  if (!lista.length) { tbody.innerHTML = ''; empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');
  const claseMap = { login:'audit-login', logout:'audit-logout', add:'audit-add', delete:'audit-delete', clear:'audit-clear' };
  const labelMap = { login:'LOGIN', logout:'LOGOUT', add:'REGISTRO', delete:'ELIMINACIÓN', clear:'LIMPIEZA' };
  tbody.innerHTML = lista.map((e, i) => `
    <tr>
      <td>${i+1}</td>
      <td class="val-mono" style="font-size:0.75rem">${new Date(e.fecha).toLocaleString('es-PE')}</td>
      <td>${e.usuario}</td>
      <td><span class="role-tag ${e.rol==='employee'?'role-employee':''}">${e.rol==='admin'?'Admin':'Colaborador'}</span></td>
      <td><span class="audit-action ${claseMap[e.tipo]||''}">${labelMap[e.tipo]||e.tipo}</span></td>
      <td style="color:var(--text-secondary);font-size:0.8rem">${e.detalle}</td>
    </tr>`).join('');
}

/* ══════════════════════════════════════════════
   LOGIN / LOGOUT
   ══════════════════════════════════════════════ */
async function mostrarApp(session) {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('appScreen').classList.remove('hidden');
  document.getElementById('userBadgeName').textContent = session.display;
  const rt = document.getElementById('userRoleTag');
  rt.textContent = session.role === 'admin' ? 'Admin' : 'Colaborador';
  rt.className   = `role-tag ${session.role === 'employee' ? 'role-employee' : ''}`;
  document.querySelectorAll('.tab-admin-only').forEach(el => el.classList.toggle('hidden', !isAdmin()));
  document.querySelectorAll('.admin-only').forEach(el => el.classList.toggle('hidden', !isAdmin()));
  document.querySelectorAll('th.admin-only, td.admin-only').forEach(el => el.classList.toggle('hidden', !isAdmin()));
  document.getElementById('headerDate').textContent =
    new Date().toLocaleDateString('es-PE', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  await renderAsistencia();
  toggleAsistenciaMode();
  await renderSelectMeses();
  await renderVentas();
  actualizarPreview();
  await renderSelectMesesDescargas();
}

function mostrarLogin() {
  document.getElementById('appScreen').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
}

document.getElementById('formLogin').addEventListener('submit', async function(e) {
  e.preventDefault();
  const userEl = document.getElementById('loginUser');
  const passEl = document.getElementById('loginPass');
  const errBox = document.getElementById('loginErrorBox');
  clearErrors(['err-loginUser','err-loginPass'], [userEl, passEl]);
  errBox.textContent = ''; errBox.classList.remove('show');
  let ok = true;
  if (!userEl.value.trim()) { setError('err-loginUser', userEl, 'Ingresa tu usuario.'); ok = false; }
  if (!passEl.value)        { setError('err-loginPass', passEl, 'Ingresa tu contraseña.'); ok = false; }
  if (!ok) return;
  const found = USERS.find(u => u.username === userEl.value.trim() && u.password === passEl.value);
  if (!found) {
    errBox.textContent = 'Usuario o contraseña incorrectos.';
    errBox.classList.add('show');
    passEl.value = ''; passEl.focus(); return;
  }
  const session = { username: found.username, role: found.role, display: found.display };
  setSession(session);
  await audit('login', `Inicio de sesión: ${found.display}`);
  await mostrarApp(session);
  this.reset();
});

document.getElementById('btnLogout').addEventListener('click', async () => {
  await audit('logout', `Cierre de sesión: ${getSession()?.display}`);
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
   ASISTENCIA
   ══════════════════════════════════════════════ */
function hoyISO() {
  const h = new Date();
  return `${h.getFullYear()}-${String(h.getMonth()+1).padStart(2,'0')}-${String(h.getDate()).padStart(2,'0')}`;
}

async function getAsistencias() {
  const { data, error } = await sb
    .from('asistencia')
    .select('*')
    .eq('fecha', hoyISO())
    .order('entrada', { ascending: true });
  if (error) { logErr('getAsistencias', error); return []; }
  return data || [];
}

async function renderAsistencia() {
  const lista = await getAsistencias();
  const tbody = document.getElementById('bodyAsistencia');
  const empty = document.getElementById('emptyAsistencia');
  const total = document.getElementById('totalAsistencias');
  total.textContent = `${lista.length} trabajador${lista.length!==1?'es':''} registrado${lista.length!==1?'s':''}`;
  if (!lista.length) { tbody.innerHTML = ''; empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');
  tbody.innerHTML = lista.map((r, i) => `
    <tr class="${i===lista.length-1?'row-new':''}">
      <td>${i+1}</td>
      <td>${r.nombre}</td>
      <td class="val-mono">${r.entrada}</td>
      <td class="val-mono">${r.salida||'<span style="color:var(--text-muted)">—</span>'}</td>
      <td class="val-mono">${calcHoras(r.entrada, r.salida)}</td>
      <td><span class="reg-by">${r.registrado_por||'—'}</span></td>
      ${isAdmin()?`<td><button class="btn-delete" onclick="delAsistencia('${r.id}')">✕</button></td>`:'<td></td>'}
    </tr>`).join('');
}

async function delAsistencia(id) {
  if (!isAdmin()) return;
  const lista = await getAsistencias();
  const reg   = lista.find(r => r.id === id);
  const { error } = await sb.from('asistencia').delete().eq('id', id);
  if (error) { logErr('delAsistencia', error); mostrarToast('Error al eliminar.', 'error'); return; }
  await audit('delete', `Asistencia eliminada: ${reg?.nombre||id}`);
  await renderAsistencia();
  mostrarToast('Registro eliminado.', 'info');
}

function toggleAsistenciaMode() {
  const isEntrada = document.querySelector('input[name="accionAsistencia"]:checked').value === 'entrada';
  document.getElementById('groupSelectSalida').style.display                    = isEntrada ? 'none'  : 'block';
  document.getElementById('nombreTrabajador').closest('.form-group').style.display = isEntrada ? 'flex'  : 'none';
  document.getElementById('horaEntrada').closest('.form-group').style.display   = isEntrada ? 'flex'  : 'none';
  document.getElementById('horaSalida').closest('.form-group').style.display    = 'flex';
  if (!isEntrada) populateSelectSalida();
}

async function populateSelectSalida() {
  const select = document.getElementById('selectTrabajadorSalida');
  const lista  = await getAsistencias();
  const sinSalida = lista.filter(r => r.entrada && !r.salida);
  select.innerHTML = '<option value="">— Selecciona —</option>' +
    sinSalida.map(r => `<option value="${r.id}">${r.nombre} (entró ${r.entrada})</option>`).join('');
}

document.querySelectorAll('input[name="accionAsistencia"]').forEach(r =>
  r.addEventListener('change', toggleAsistenciaMode));

document.getElementById('formAsistencia').addEventListener('submit', async function(e) {
  e.preventDefault();
  const accion = document.querySelector('input[name="accionAsistencia"]:checked').value;

  if (accion === 'entrada') {
    const nom = document.getElementById('nombreTrabajador');
    const ent = document.getElementById('horaEntrada');
    const sal = document.getElementById('horaSalida');
    clearErrors(['err-nombre','err-entrada','err-salida'], [nom, ent, sal]);
    let ok = true;
    if (!nom.value.trim() || nom.value.trim().length < 2) { setError('err-nombre', nom, 'Mínimo 2 caracteres.'); ok = false; }
    if (!ent.value) { setError('err-entrada', ent, 'Ingresa la hora de entrada.'); ok = false; }
    if (sal.value && sal.value === ent.value) { setError('err-salida', sal, 'Salida no puede ser igual a entrada.'); ok = false; }
    if (!ok) return;

    const nuevo = {
      nombre:         nom.value.trim(),
      entrada:        ent.value,
      salida:         sal.value || null,
      registrado_por: getSession()?.display || '—',
      fecha:          hoyISO()
    };

    const { data, error } = await sb.from('asistencia').insert(nuevo).select();
    if (error) {
      logErr('asistencia.insert', error);
      mostrarToast(`Error: ${error.message}`, 'error');
      return;
    }

    await audit('add', `Asistencia: ${nuevo.nombre} entrada ${nuevo.entrada}`);
    await renderAsistencia();
    mostrarToast(`✓ Asistencia de ${nuevo.nombre} registrada.`);
    this.reset();
    toggleAsistenciaMode();

  } else {
    const select = document.getElementById('selectTrabajadorSalida');
    const sal    = document.getElementById('horaSalida');
    clearErrors(['err-select','err-salida'], [select, sal]);
    let ok = true;
    if (!select.value) { setError('err-select', select, 'Selecciona un trabajador.'); ok = false; }
    if (!sal.value)    { setError('err-salida', sal, 'Ingresa la hora de salida.'); ok = false; }
    if (!ok) return;

    const lista = await getAsistencias();
    const reg   = lista.find(r => r.id === select.value);
    if (!reg) { mostrarToast('Registro no encontrado.', 'error'); return; }
    if (sal.value === reg.entrada) { setError('err-salida', sal, 'Salida no puede ser igual a entrada.'); return; }

    const { error } = await sb.from('asistencia').update({ salida: sal.value }).eq('id', select.value);
    if (error) {
      logErr('asistencia.update', error);
      mostrarToast(`Error: ${error.message}`, 'error');
      return;
    }

    await audit('add', `Salida: ${reg.nombre} a las ${sal.value}`);
    await renderAsistencia();
    mostrarToast(`✓ Salida de ${reg.nombre} registrada.`);
    this.reset();
    toggleAsistenciaMode();
  }
});

document.getElementById('clearAsistencia').addEventListener('click', async () => {
  if (!isAdmin()) return;
  if (!confirm('¿Eliminar todos los registros de asistencia de hoy?')) return;
  const { error } = await sb.from('asistencia').delete().eq('fecha', hoyISO());
  if (error) { logErr('clearAsistencia', error); mostrarToast('Error al limpiar.', 'error'); return; }
  await audit('clear', 'Asistencias del día eliminadas');
  await renderAsistencia();
  mostrarToast('Registros eliminados.', 'info');
});

/* ══════════════════════════════════════════════
   VENTAS — MESES
   ══════════════════════════════════════════════ */
async function getMeses() {
  const { data, error } = await sb.from('meses').select('*').order('nombre', { ascending: true });
  if (error) { logErr('getMeses', error); return []; }
  return data || [];
}

async function getDias(mesId) {
  const { data, error } = await sb.from('dias').select('*').eq('mes_id', mesId).order('fecha', { ascending: true });
  if (error) { logErr('getDias', error); return []; }
  return data || [];
}

const getMesActivo = () => document.getElementById('mesSelector').value;

async function renderSelectMeses() {
  const sel   = document.getElementById('mesSelector');
  const prev  = sel.value;
  const meses = await getMeses();
  sel.innerHTML = meses.length
    ? meses.map(m => `<option value="${m.id}">${m.nombre}</option>`).join('')
    : '<option value="">— Sin meses creados —</option>';
  if (prev && meses.find(m => m.id === prev)) sel.value = prev;
}

async function renderVentas() {
  const mesId = getMesActivo();
  const meses = await getMeses();
  const mes   = meses.find(m => m.id === mesId);
  document.getElementById('labelMesActual').textContent =
    mes ? `DÍAS REGISTRADOS — ${mes.nombre.toUpperCase()}` : 'DÍAS REGISTRADOS';
  const lista = mesId ? await getDias(mesId) : [];
  const tbody = document.getElementById('bodyVentas');
  const empty = document.getElementById('emptyVentas');
  if (!lista.length) { tbody.innerHTML=''; empty.classList.remove('hidden'); actualizarReporte([]); return; }
  empty.classList.add('hidden');
  tbody.innerHTML = lista.map((d, i) => {
    const bruto   = (d.efectivo||0)+(d.yape||0)+(d.plin||0);
    const gastos  = d.transf||0;
    const neto    = bruto - gastos;
    const gan     = d.ganancia||0;
    const balance = neto - gan;
    const clsGan  = gan>=0?'val-ganancia':'val-negativo';
    const fechaFmt= new Date(d.fecha+'T12:00:00').toLocaleDateString('es-PE',{weekday:'short',day:'2-digit',month:'short',year:'numeric'});
    return `
      <tr class="${i===lista.length-1?'row-new':''}">
        <td>${i+1}</td>
        <td>${fechaFmt}</td>
        <td class="val-mono" style="color:#10b981">${fmt(d.efectivo)}</td>
        <td class="val-mono val-yape">${fmt(d.yape)}</td>
        <td class="val-mono val-plin">${fmt(d.plin)}</td>
        <td class="val-mono" style="color:#ef4444">${fmt(gastos)}</td>
        <td class="val-mono val-accent">${fmt(bruto)}</td>
        <td class="val-mono val-accent">${fmt(neto)}</td>
        <td class="val-mono ${clsGan}">${fmt(gan)}</td>
        <td class="val-mono" style="color:#8892b0">${fmt(balance)}</td>
        <td class="val-mono" style="color:var(--text-secondary)">${fmtPct(gan,neto)}</td>
        <td><span class="reg-by">${d.registrado_por||'—'}</span></td>
        ${isAdmin()?`<td><button class="btn-delete" onclick="delDia('${mesId}','${d.id}')">✕</button></td>`:'<td></td>'}
      </tr>`;
  }).join('');
  actualizarReporte(lista);
}

function actualizarReporte(lista) {
  const totalE  = lista.reduce((a,d)=>a+(d.efectivo||0),0);
  const totalY  = lista.reduce((a,d)=>a+(d.yape||0),0);
  const totalP  = lista.reduce((a,d)=>a+(d.plin||0),0);
  const totalT  = lista.reduce((a,d)=>a+(d.transf||0),0);
  const bruto   = totalE+totalY+totalP;
  const neto    = bruto-totalT;
  const totalG  = lista.reduce((a,d)=>a+(d.ganancia||0),0);
  const balance = neto-totalG;
  document.getElementById('reporteEfectivo').textContent     = fmt(totalE);
  document.getElementById('reporteYape').textContent          = fmt(totalY);
  document.getElementById('reportePlin').textContent          = fmt(totalP);
  document.getElementById('reporteTransf').textContent        = fmt(totalT);
  document.getElementById('reporteTotalBruto').textContent    = fmt(bruto);
  document.getElementById('reporteTotalVentas').textContent   = fmt(neto);
  document.getElementById('reporteCostoTotal').textContent    = fmt(totalG);
  document.getElementById('reporteGananciaTotal').textContent = fmt(balance);
  document.getElementById('reporteDias').textContent          = lista.length;
  document.getElementById('reporteGananciaTotal').style.color = balance>=0?'var(--success)':'var(--danger)';
}

async function delDia(mesId, id) {
  if (!isAdmin()) return;
  const lista = await getDias(mesId);
  const reg   = lista.find(d => d.id === id);
  const { error } = await sb.from('dias').delete().eq('id', id);
  if (error) { logErr('delDia', error); mostrarToast('Error al eliminar.','error'); return; }
  const bruto = (reg?.efectivo||0)+(reg?.yape||0)+(reg?.plin||0);
  const neto  = bruto-(reg?.transf||0);
  await audit('delete', `Día eliminado: ${reg?.fecha} — Neto: ${fmt(neto)}`);
  await renderVentas();
  await renderSelectMesesDescargas();
  mostrarToast('Día eliminado.','info');
}

function actualizarPreview() {
  const e = parseFloat(document.getElementById('ventaEfectivo').value)||0;
  const y = parseFloat(document.getElementById('ventaYape').value)||0;
  const p = parseFloat(document.getElementById('ventaPlin').value)||0;
  const t = parseFloat(document.getElementById('ventaTransf').value)||0;
  const g = parseFloat(document.getElementById('gananciaDelDia').value)||0;
  const bruto   = e+y+p;
  const neto    = bruto-t;
  const balance = neto-g;
  document.getElementById('previewEfectivo').textContent   = fmt(e);
  document.getElementById('previewYapeVal').textContent    = fmt(y);
  document.getElementById('previewPlinVal').textContent    = fmt(p);
  document.getElementById('previewTransfVal').textContent  = fmt(t);
  document.getElementById('previewTotalBruto').textContent = fmt(bruto);
  document.getElementById('previewTotal').textContent      = fmt(neto);
  document.getElementById('previewGanancia').textContent   = fmt(g);
  document.getElementById('previewBalance').textContent    = fmt(balance);
  document.getElementById('previewGanancia').style.color   = g>=0?'var(--accent-light)':'var(--danger)';
}

['ventaEfectivo','ventaYape','ventaPlin','ventaTransf','gananciaDelDia'].forEach(id =>
  document.getElementById(id).addEventListener('input', actualizarPreview));

document.getElementById('formVentas').addEventListener('submit', async function(e) {
  e.preventDefault();
  const fec      = document.getElementById('fechaVenta');
  const efectivo = document.getElementById('ventaEfectivo');
  const yape     = document.getElementById('ventaYape');
  const plin     = document.getElementById('ventaPlin');
  const transf   = document.getElementById('ventaTransf');
  const ganancia = document.getElementById('gananciaDelDia');
  clearErrors(['err-fecha','err-efectivo','err-yape','err-plin','err-transf','err-ganancia'],
              [fec,efectivo,yape,plin,transf,ganancia]);
  const mesId = getMesActivo();
  if (!mesId) { mostrarToast('Crea un mes primero.','error'); return; }
  let ok = true;
  if (!fec.value) { setError('err-fecha', fec, 'Selecciona una fecha.'); ok = false; }
  const eNum = parseFloat(efectivo.value)||0;
  const yNum = parseFloat(yape.value)||0;
  const pNum = parseFloat(plin.value)||0;
  const tNum = parseFloat(transf.value)||0;
  const gNum = parseFloat(ganancia.value)||0;
  if (eNum===0 && yNum===0 && pNum===0) { setError('err-efectivo', efectivo, 'Ingresa al menos un monto.'); ok=false; }
  if (gNum < 0) { setError('err-ganancia', ganancia, 'La ganancia no puede ser negativa.'); ok=false; }
  if (!ok) return;

  const lista  = await getDias(mesId);
  const existe = lista.find(d => d.fecha === fec.value);
  const bruto  = eNum+yNum+pNum;
  const neto   = bruto-tNum;

  if (existe) {
    if (!isAdmin()) { mostrarToast('Solo el administrador puede modificar un día existente.','error'); return; }
    if (!confirm(`Ya existe registro para ${fec.value}. ¿Sobreescribir?`)) return;
    const { error } = await sb.from('dias').update({
      efectivo: eNum, yape: yNum, plin: pNum, transf: tNum, ganancia: gNum,
      registrado_por: getSession()?.display||'—'
    }).eq('id', existe.id);
    if (error) { logErr('dias.update', error); mostrarToast(`Error: ${error.message}`,'error'); return; }
    await audit('add', `Día actualizado: ${fec.value} — Bruto:${fmt(bruto)} Neto:${fmt(neto)} Ganancia:${fmt(gNum)}`);
  } else {
    const { error } = await sb.from('dias').insert({
      mes_id: mesId, fecha: fec.value,
      efectivo: eNum, yape: yNum, plin: pNum, transf: tNum, ganancia: gNum,
      registrado_por: getSession()?.display||'—'
    }).select();
    if (error) { logErr('dias.insert', error); mostrarToast(`Error: ${error.message}`,'error'); return; }
    await audit('add', `Día registrado: ${fec.value} — Bruto:${fmt(bruto)} Neto:${fmt(neto)} Ganancia:${fmt(gNum)}`);
  }

  await renderVentas();
  await renderSelectMesesDescargas();
  mostrarToast('✓ Día guardado correctamente.');
  this.reset();
  actualizarPreview();
  document.getElementById('fechaVenta').value = hoyISO();
});

document.getElementById('clearDia').addEventListener('click', async () => {
  if (!isAdmin()) return;
  const mesId = getMesActivo();
  if (!mesId) { mostrarToast('No hay mes seleccionado.','error'); return; }
  const meses = await getMeses();
  const mes   = meses.find(m => m.id === mesId);
  if (!confirm(`¿Eliminar todos los días de "${mes?.nombre}"?`)) return;
  const { error } = await sb.from('dias').delete().eq('mes_id', mesId);
  if (error) { logErr('clearDia', error); mostrarToast('Error al limpiar.','error'); return; }
  await audit('clear', `Mes limpiado: ${mes?.nombre}`);
  await renderVentas();
  await renderSelectMesesDescargas();
  mostrarToast('Mes limpiado.','info');
});

document.getElementById('mesSelector').addEventListener('change', async () => {
  await renderVentas();
  await renderSelectMesesDescargas();
});

document.getElementById('clearAuditoria').addEventListener('click', async () => {
  if (!confirm('¿Eliminar todo el historial de auditoría?')) return;
  await audit('clear', 'Historial limpiado');
  const { error } = await sb.from('auditoria').delete().neq('id','00000000-0000-0000-0000-000000000000');
  if (error) { logErr('clearAuditoria', error); mostrarToast('Error al limpiar.','error'); return; }
  await renderAuditoria();
  mostrarToast('Historial limpiado.','info');
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
overlay.addEventListener('click', e => { if (e.target===overlay) overlay.classList.remove('active'); });

document.getElementById('modalConfirmar').addEventListener('click', async () => {
  const nombre = inputMes.value.trim();
  const errEl  = document.getElementById('err-mes');
  inputMes.classList.remove('input-error');
  errEl.textContent = '';
  if (!nombre || nombre.length < 2) { errEl.textContent='Mínimo 2 caracteres.'; inputMes.classList.add('input-error'); return; }
  const meses = await getMeses();
  if (meses.find(m => m.nombre.toLowerCase()===nombre.toLowerCase())) {
    errEl.textContent='Ya existe un mes con ese nombre.'; inputMes.classList.add('input-error'); return;
  }
  const { data, error } = await sb.from('meses').insert({ nombre }).select();
  if (error) { logErr('meses.insert', error); mostrarToast(`Error: ${error.message}`,'error'); return; }
  const nuevoMes = data[0];
  await renderSelectMeses();
  await renderSelectMesesDescargas();
  document.getElementById('mesSelector').value = nuevoMes.id;
  await renderVentas();
  await audit('add', `Mes creado: ${nombre}`);
  overlay.classList.remove('active');
  mostrarToast(`✓ Mes "${nombre}" creado.`);
});

inputMes.addEventListener('keydown', e => { if (e.key==='Enter') document.getElementById('modalConfirmar').click(); });

/* ══════════════════════════════════════════════
   DESCARGAS — Excel con SheetJS
   ══════════════════════════════════════════════ */
function exportarExcel(filename, sheetName, headers, rows) {
  if (typeof XLSX === 'undefined') { mostrarToast('Librería Excel no disponible.','error'); return; }
  const ws   = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols']= headers.map((h,i) => ({
    wch: Math.min(Math.max(String(h).length, ...rows.map(r=>String(r[i]??'').length)) + 4, 40)
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0,31));
  XLSX.writeFile(wb, filename+'.xlsx');
}

async function renderSelectMesesDescargas() {
  const sel   = document.getElementById('selectMesVentasDescargas');
  const meses = await getMeses();
  sel.innerHTML = meses.length
    ? meses.map(m => `<option value="${m.id}">${m.nombre}</option>`).join('')
    : '<option value="">— Sin meses —</option>';
  if (meses.length) sel.value = meses[meses.length-1].id;
}

document.getElementById('btnDescargarVentas').addEventListener('click', async () => {
  const mesId = document.getElementById('selectMesVentasDescargas').value;
  if (!mesId) { mostrarToast('Selecciona un mes.','error'); return; }
  const meses = await getMeses();
  const mes   = meses.find(m=>m.id===mesId);
  const dias  = await getDias(mesId);
  if (!dias.length) { mostrarToast('No hay datos en este mes.','info'); return; }
  const headers = ['Fecha','Día','Efectivo (S/)','Yape (S/)','Plin (S/)','Gastos (S/)','Total Bruto (S/)','Total Neto (S/)','Ganancia (S/)','Balance (S/)','Margen %','Registrado por'];
  const rows = [...dias].sort((a,b)=>a.fecha.localeCompare(b.fecha)).map(d => {
    const bruto   = (d.efectivo||0)+(d.yape||0)+(d.plin||0);
    const neto    = bruto-(d.transf||0);
    const gan     = d.ganancia||0;
    const dia     = new Date(d.fecha+'T12:00:00').toLocaleDateString('es-PE',{weekday:'short'}).toUpperCase();
    return [d.fecha, dia, +(d.efectivo||0).toFixed(2), +(d.yape||0).toFixed(2), +(d.plin||0).toFixed(2),
      +(d.transf||0).toFixed(2), +bruto.toFixed(2), +neto.toFixed(2), +gan.toFixed(2),
      +(neto-gan).toFixed(2), neto>0?((gan/neto)*100).toFixed(1)+'%':'0%', d.registrado_por||'—'];
  });
  const tE=dias.reduce((a,d)=>a+(d.efectivo||0),0), tY=dias.reduce((a,d)=>a+(d.yape||0),0);
  const tP=dias.reduce((a,d)=>a+(d.plin||0),0),     tT=dias.reduce((a,d)=>a+(d.transf||0),0);
  const tB=tE+tY+tP, tN=tB-tT, tG=dias.reduce((a,d)=>a+(d.ganancia||0),0);
  rows.push([]); rows.push(['TOTAL','',+tE.toFixed(2),+tY.toFixed(2),+tP.toFixed(2),+tT.toFixed(2),
    +tB.toFixed(2),+tN.toFixed(2),+tG.toFixed(2),+(tN-tG).toFixed(2),
    tN>0?((tG/tN)*100).toFixed(1)+'%':'0%','']);
  const hoy = new Date();
  exportarExcel(`Ventas_${mes.nombre}_${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-${String(hoy.getDate()).padStart(2,'0')}`,
    mes.nombre, headers, rows);
  mostrarToast('✓ Ventas descargadas.','success');
});

document.getElementById('btnDescargarAsistencias').addEventListener('click', async () => {
  const asistencias = await getAsistencias();
  if (!asistencias.length) { mostrarToast('No hay asistencias hoy.','info'); return; }
  const headers = ['#','Trabajador','Hora Entrada','Hora Salida','Duración','Registrado por'];
  const rows = asistencias
    .sort((a,b)=>a.entrada.localeCompare(b.entrada))
    .map((r,i)=>[i+1, r.nombre, r.entrada, r.salida||'—', calcHoras(r.entrada,r.salida), r.registrado_por||'—']);
  const hoy = new Date();
  exportarExcel(`Asistencias_${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-${String(hoy.getDate()).padStart(2,'0')}`,
    'Asistencias', headers, rows);
  mostrarToast('✓ Asistencias descargadas.','success');
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
  document.getElementById('fechaVenta').value = hoyISO();
})();
