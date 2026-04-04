/* ================================================
   script.js — KRD Importaciones v6 (REFACTORIZADO COMPLETO)
   ================================================
   MEJORAS v6:
   ✔ Colaboradores: ingreso/salida en orden estricto (entrada → salida)
   ✔ Bloquear salida si no existe ingreso previo del día
   ✔ Bloquear ingresos duplicados y múltiples salidas
   ✔ Colaboradores NO ven tabla de asistencias, solo su propio estado
   ✔ Colaboradores NO ven tabla ni historial de ventas ni montos
   ✔ Tabla de registros de asistencia SOLO para admin
   ✔ Tabla de registros de ventas SOLO para admin
   ✔ Tarjetas resumen mensual SOLO para admin
   ✔ Pestañas Asistencia, Auditoría y Descargas SOLO para admin
   ✔ Modales elegantes en todos los confirm()
   ✔ Confirmación de guardado antes de insertar registros
   ✔ Reautenticación admin antes de exportar Excel
   ✔ Bug fecha-mes corregido (mesId capturado antes de await)
   ✔ Sin cambios en credenciales ni integración Supabase
   ================================================ */

/* ══════════════════════════════════════════════
   1. USUARIOS & SUPABASE
   ══════════════════════════════════════════════ */
const USERS = [
  { username: 'admin',  password: '5756784',   role: 'admin',    display: 'Administrador' },
  { username: 'MIXY',   password: 'Mixy2826',  role: 'employee', display: 'Mixy' },
  { username: 'JAIRO',  password: 'Jairo1726', role: 'employee', display: 'Jairo' },
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
  const { data, error } = await supabaseClient
    .from('auditoria')
    .select('*')
    .order('fecha', { ascending: false })
    .limit(500);
  if (error) { console.error(error); return []; }
  return data || [];
}

async function audit(tipo, detalle) {
  const s = getSession();
  const entry = {
    fecha:   new Date().toISOString(),
    usuario: s ? s.username : '—',
    rol:     s ? s.role     : '—',
    tipo,
    detalle
  };
  const { error } = await supabaseClient.from('auditoria').insert(entry);
  if (error) console.error('Audit error:', error);
}

async function renderAuditoria() {
  if (!isAdmin()) return;
  const lista = await getAudit();
  const tbody = document.getElementById('bodyAuditoria');
  const empty = document.getElementById('emptyAuditoria');

  if (!lista.length) {
    tbody.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  const claseMap = { login: 'audit-login', logout: 'audit-logout', add: 'audit-add', delete: 'audit-delete', clear: 'audit-clear' };
  const labelMap = { login: 'LOGIN', logout: 'LOGOUT', add: 'REGISTRO', delete: 'ELIMINACIÓN', clear: 'LIMPIEZA' };

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
  t._t = setTimeout(() => t.classList.remove('show'), 3500);
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
  const el = document.getElementById(idMsg);
  if (el) el.textContent = msg;
  if (input) input.classList.add('input-error');
}
function clearErrors(ids, inputs = []) {
  ids.forEach(id => { const el = document.getElementById(id); if (el) el.textContent = ''; });
  inputs.forEach(i => i && i.classList.remove('input-error'));
}
function getTodayStr() {
  return new Date().toISOString().split('T')[0];
}
function getNowTimeStr() {
  const n = new Date();
  return `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`;
}

/* ══════════════════════════════════════════════
   4. MODALES ELEGANTES
   ══════════════════════════════════════════════ */

/* ── Modal de confirmación genérico (reemplaza confirm()) ── */
function mostrarConfirm(titulo, descripcion, labelConfirmar = 'Confirmar') {
  return new Promise(resolve => {
    document.getElementById('confirmTitle').textContent   = titulo;
    document.getElementById('confirmDesc').textContent    = descripcion;
    document.getElementById('confirmAceptar').textContent = labelConfirmar;

    const overlay = document.getElementById('modalConfirmOverlay');
    overlay.classList.add('active');

    const onAceptar = () => { overlay.classList.remove('active'); cleanup(); resolve(true); };
    const onCancelar = () => { overlay.classList.remove('active'); cleanup(); resolve(false); };
    const cleanup = () => {
      document.getElementById('confirmAceptar').removeEventListener('click', onAceptar);
      document.getElementById('confirmCancelar').removeEventListener('click', onCancelar);
    };

    document.getElementById('confirmAceptar').addEventListener('click', onAceptar);
    document.getElementById('confirmCancelar').addEventListener('click', onCancelar);
  });
}

/* ── Modal de previsualización antes de guardar ── */
function mostrarGuardar(descripcion, previewHtml) {
  return new Promise(resolve => {
    document.getElementById('guardarDesc').textContent     = descripcion;
    document.getElementById('guardarPreviewBox').innerHTML = previewHtml;

    const overlay = document.getElementById('modalGuardarOverlay');
    overlay.classList.add('active');

    const onAceptar  = () => { overlay.classList.remove('active'); cleanup(); resolve(true); };
    const onCancelar = () => { overlay.classList.remove('active'); cleanup(); resolve(false); };
    const cleanup = () => {
      document.getElementById('guardarAceptar').removeEventListener('click', onAceptar);
      document.getElementById('guardarCancelar').removeEventListener('click', onCancelar);
    };

    document.getElementById('guardarAceptar').addEventListener('click', onAceptar);
    document.getElementById('guardarCancelar').addEventListener('click', onCancelar);
  });
}

/* ── Modal de reautenticación admin ── */
function mostrarReauth() {
  return new Promise(resolve => {
    const overlay   = document.getElementById('modalReauthOverlay');
    const inputPass = document.getElementById('reauthPass');
    const errEl     = document.getElementById('err-reauth');

    inputPass.value   = '';
    errEl.textContent = '';
    inputPass.classList.remove('input-error');
    overlay.classList.add('active');
    setTimeout(() => inputPass.focus(), 80);

    const onAceptar = () => {
      const pass  = inputPass.value;
      const admin = USERS.find(u => u.role === 'admin');
      if (!admin || pass !== admin.password) {
        errEl.textContent = 'Contraseña incorrecta.';
        inputPass.classList.add('input-error');
        inputPass.value = '';
        inputPass.focus();
        return;
      }
      overlay.classList.remove('active');
      cleanup();
      resolve(true);
    };
    const onCancelar = () => { overlay.classList.remove('active'); cleanup(); resolve(false); };
    const onCerrar   = () => { overlay.classList.remove('active'); cleanup(); resolve(false); };
    const onKeydown  = (e) => {
      if (e.key === 'Enter') onAceptar();
      if (e.key === 'Escape') onCancelar();
    };

    const cleanup = () => {
      document.getElementById('reauthAceptar').removeEventListener('click', onAceptar);
      document.getElementById('reauthCancelar').removeEventListener('click', onCancelar);
      document.getElementById('reauthCerrar').removeEventListener('click', onCerrar);
      inputPass.removeEventListener('keydown', onKeydown);
    };

    document.getElementById('reauthAceptar').addEventListener('click', onAceptar);
    document.getElementById('reauthCancelar').addEventListener('click', onCancelar);
    document.getElementById('reauthCerrar').addEventListener('click', onCerrar);
    inputPass.addEventListener('keydown', onKeydown);
  });
}

/* ── Modal hora colaborador (entrada o salida) ── */
function mostrarColabHoraModal(tipo) {
  return new Promise(resolve => {
    const overlay    = document.getElementById('modalColabHoraOverlay');
    const iconEl     = document.getElementById('colabModalIcon');
    const titleEl    = document.getElementById('colabModalTitle');
    const descEl     = document.getElementById('colabModalDesc');
    const horaInput  = document.getElementById('colabModalHora');
    const errEl      = document.getElementById('err-colab-modal-hora');

    const esEntrada = tipo === 'entrada';

    iconEl.className = 'colab-modal-icon-wrap' + (esEntrada ? '' : ' modal-icon-exit');
    iconEl.innerHTML = esEntrada
      ? `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>`
      : `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`;

    titleEl.textContent = esEntrada ? 'Registrar entrada' : 'Registrar salida';
    descEl.textContent  = esEntrada ? 'Confirma tu hora de entrada al trabajo.' : 'Confirma tu hora de salida del trabajo.';

    horaInput.value   = getNowTimeStr();
    errEl.textContent = '';
    horaInput.classList.remove('input-error');
    overlay.classList.add('active');
    setTimeout(() => horaInput.focus(), 80);

    const onConfirmar = () => {
      const hora = horaInput.value.trim();
      if (!hora) {
        errEl.textContent = 'Ingresa la hora.';
        horaInput.classList.add('input-error');
        return;
      }
      overlay.classList.remove('active');
      cleanup();
      resolve(hora);
    };
    const onCancelar = () => {
      overlay.classList.remove('active');
      cleanup();
      resolve(null);
    };
    const onKeydown = (e) => {
      if (e.key === 'Enter') onConfirmar();
      if (e.key === 'Escape') onCancelar();
    };
    const cleanup = () => {
      document.getElementById('colabModalConfirmar').removeEventListener('click', onConfirmar);
      document.getElementById('colabModalCancelar').removeEventListener('click', onCancelar);
      horaInput.removeEventListener('keydown', onKeydown);
    };

    document.getElementById('colabModalConfirmar').addEventListener('click', onConfirmar);
    document.getElementById('colabModalCancelar').addEventListener('click', onCancelar);
    horaInput.addEventListener('keydown', onKeydown);
  });
}

/* ══════════════════════════════════════════════
   5. LOGIN / LOGOUT
   ══════════════════════════════════════════════ */
async function mostrarApp(session) {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('appScreen').classList.remove('hidden');

  document.getElementById('userBadgeName').textContent = session.display;
  const roleTag = document.getElementById('userRoleTag');
  roleTag.textContent = session.role === 'admin' ? 'Admin' : 'Colaborador';
  roleTag.className   = `role-tag ${session.role === 'employee' ? 'role-employee' : ''}`;

  /* ── Visibilidad por rol ── */
  document.querySelectorAll('.tab-admin-only').forEach(el => {
    el.classList.toggle('hidden', !isAdmin());
  });
  document.querySelectorAll('.admin-only').forEach(el => {
    el.classList.toggle('hidden', !isAdmin());
  });
  /* Elementos solo para colaborador */
  document.querySelectorAll('.colab-only').forEach(el => {
    el.classList.toggle('hidden', isAdmin());
  });

  document.getElementById('headerDate').textContent =
    new Date().toLocaleDateString('es-PE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  if (isAdmin()) {
    /* Admin: formulario completo de asistencia, tabla visible */
    document.getElementById('asistAdminView').classList.remove('hidden');
    document.getElementById('formAsistencia').classList.remove('hidden');
    document.getElementById('asistColabView').classList.add('hidden');
    document.getElementById('cardTablaAsistencia').classList.remove('hidden');
    document.getElementById('cardTablaVentas').classList.remove('hidden');
    document.getElementById('reporteGrid').classList.remove('hidden');
    document.getElementById('cardColabVentasMsg').classList.add('hidden');

    activarTab('asistencia');
    await renderAsistencia();
    toggleAsistenciaMode();

    await renderSelectMesesDescargas();

  } else {
    /* Colaborador: ve su formulario de registro + tabla del día */
    document.getElementById('asistAdminView').classList.add('hidden');
    document.getElementById('formAsistencia').classList.add('hidden');
    document.getElementById('asistColabView').classList.remove('hidden');
    document.getElementById('cardTablaAsistencia').classList.remove('hidden');
    document.getElementById('cardTablaVentas').classList.add('hidden');
    document.getElementById('reporteGrid').classList.add('hidden');
    document.getElementById('cardColabVentasMsg').classList.add('hidden');

    activarTab('asistencia');
    await renderColabAsistencia();
    await renderAsistencia();
  }

  await renderSelectMeses();
  await renderVentas();
  actualizarPreview();

  updateFieldPermissions();
}

function activarTab(tabName) {
  /* Bloqueo de seguridad: solo auditoria y descargas son exclusivas de admin */
  const adminOnlyTabs = ['auditoria', 'descargas'];
  if (!isAdmin() && adminOnlyTabs.includes(tabName)) return;

  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  const btn = document.querySelector(`[data-tab="${tabName}"]`);
  if (btn) btn.classList.add('active');
  const panel = document.getElementById(`tab-${tabName}`);
  if (panel) panel.classList.add('active');
}

function mostrarLogin() {
  document.getElementById('appScreen').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
}

document.getElementById('formLogin').addEventListener('submit', async function (e) {
  e.preventDefault();
  const user     = document.getElementById('loginUser');
  const pass     = document.getElementById('loginPass');
  const errorBox = document.getElementById('loginErrorBox');

  clearErrors(['err-loginUser', 'err-loginPass'], [user, pass]);
  errorBox.textContent = '';
  errorBox.classList.remove('show');

  let ok = true;
  if (!user.value.trim()) { setError('err-loginUser', user, 'Ingresa tu usuario.');    ok = false; }
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
  const confirmado = await mostrarConfirm(
    '¿Cerrar sesión?',
    `Saldrás de la sesión de ${getSession()?.display}.`,
    'Salir'
  );
  if (!confirmado) return;
  await audit('logout', `Cierre de sesión de ${getSession()?.display}`);
  clearSession();
  mostrarLogin();
  mostrarToast('Sesión cerrada.', 'info');
});

document.getElementById('togglePass').addEventListener('click', () => {
  const inp = document.getElementById('loginPass');
  inp.type  = inp.type === 'password' ? 'text' : 'password';
});

/* ══════════════════════════════════════════════
   PESTAÑAS
   ══════════════════════════════════════════════ */
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    /* Bloqueo doble: pestañas admin no accesibles para colaboradores */
    if (btn.classList.contains('tab-admin-only') && !isAdmin()) return;
    activarTab(btn.dataset.tab);
    if (btn.dataset.tab === 'auditoria' && isAdmin()) renderAuditoria();
  });
});

/* ══════════════════════════════════════════════
   6. ASISTENCIA
   ══════════════════════════════════════════════ */

async function getAsistencias() {
  const hoy = getTodayStr();
  const { data, error } = await supabaseClient
    .from('asistencia')
    .select('*')
    .eq('fecha', hoy)
    .order('entrada', { ascending: true });
  if (error) { console.error(error); return []; }
  return data || [];
}

/* ── Buscar el registro del colaborador actual en el día de hoy ── */
async function getRegistroColabHoy() {
  const s   = getSession();
  const hoy = getTodayStr();
  const { data, error } = await supabaseClient
    .from('asistencia')
    .select('*')
    .eq('fecha', hoy)
    .ilike('nombre', s.display)
    .limit(1);
  if (error) { console.error(error); return null; }
  return data && data.length ? data[0] : null;
}

/* ── Vista colaborador: muestra estado y botones bloqueados según flujo ── */
async function renderColabAsistencia() {
  if (isAdmin()) return;
  const s         = getSession();
  const statusEl  = document.getElementById('colabAsistStatus');
  const btnEntrada = document.getElementById('btnColabEntrada');
  const btnSalida  = document.getElementById('btnColabSalida');
  const registro  = await getRegistroColabHoy();

  /* Actualizar header con nombre y fecha */
  const headerNombre = document.getElementById('colabHeaderNombre');
  const headerFecha  = document.getElementById('colabHeaderFecha');
  if (headerNombre) headerNombre.textContent = `Hola, ${s.display}`;
  if (headerFecha) {
    headerFecha.textContent = new Date().toLocaleDateString('es-PE', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
  }

  if (!registro) {
    /* Sin entrada: solo puede registrar entrada */
    statusEl.className   = 'colab-asist-status colab-status--neutral';
    statusEl.innerHTML   = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      Hola <strong>${s.display}</strong> — Aún no has registrado tu entrada hoy. Presiona el botón para comenzar.`;
    btnEntrada.disabled  = false;
    btnSalida.disabled   = true;
    btnSalida.title      = 'Debes registrar tu entrada primero';

  } else if (registro.entrada && !registro.salida) {
    /* Tiene entrada pero sin salida */
    statusEl.className   = 'colab-asist-status colab-status--warn';
    statusEl.innerHTML   = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
      Entrada registrada a las <strong>${registro.entrada}</strong> — Cuando termines tu jornada, registra tu salida.`;
    btnEntrada.disabled  = true;
    btnEntrada.title     = 'Ya registraste tu entrada hoy';
    btnSalida.disabled   = false;
    btnSalida.title      = '';

  } else if (registro.entrada && registro.salida) {
    /* Jornada completa */
    statusEl.className   = 'colab-asist-status colab-status--ok';
    statusEl.innerHTML   = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
      ¡Jornada completa! Entrada: <strong>${registro.entrada}</strong> · Salida: <strong>${registro.salida}</strong> · Total: <strong>${calcHoras(registro.entrada, registro.salida)}</strong>`;
    btnEntrada.disabled  = true;
    btnEntrada.title     = 'Entrada ya registrada';
    btnSalida.disabled   = true;
    btnSalida.title      = 'Salida ya registrada';
  }
}

/* Botón entrada colaborador */
document.getElementById('btnColabEntrada').addEventListener('click', async () => {
  if (isAdmin()) return;
  const s = getSession();

  /* Verificar que no haya registro previo */
  const existente = await getRegistroColabHoy();
  if (existente) {
    mostrarToast('Ya tienes una entrada registrada hoy.', 'error');
    await renderColabAsistencia();
    return;
  }

  const hora = await mostrarColabHoraModal('entrada');
  if (!hora) return;

  const preview = `<strong>Trabajador:</strong> ${s.display}<br><strong>Acción:</strong> Entrada<br><strong>Hora:</strong> ${hora}<br><strong>Fecha:</strong> ${getTodayStr()}`;
  const confirmado = await mostrarGuardar('¿Confirmar registro de entrada?', preview);
  if (!confirmado) return;

  const nuevo = {
    nombre:         s.display,
    entrada:        hora,
    salida:         null,
    registrado_por: s.display,
    fecha:          getTodayStr()
  };

  const { error } = await supabaseClient.from('asistencia').insert(nuevo);
  if (error) { console.error(error); mostrarToast('Error al registrar entrada.', 'error'); return; }

  await audit('add', `Entrada registrada por colaborador: ${s.display} (${hora})`);
  mostrarToast(`✓ Entrada registrada a las ${hora}.`, 'success');
  await renderColabAsistencia();
  await renderAsistencia();
});

/* Botón salida colaborador */
document.getElementById('btnColabSalida').addEventListener('click', async () => {
  if (isAdmin()) return;
  const s = getSession();

  /* Verificar que exista entrada sin salida */
  const registro = await getRegistroColabHoy();
  if (!registro) {
    mostrarToast('Primero debes registrar tu entrada.', 'error');
    await renderColabAsistencia();
    return;
  }
  if (registro.salida) {
    mostrarToast('Tu salida ya fue registrada hoy.', 'error');
    await renderColabAsistencia();
    return;
  }

  const hora = await mostrarColabHoraModal('salida');
  if (!hora) return;

  if (hora === registro.entrada) {
    mostrarToast('La salida no puede ser igual a la entrada.', 'error');
    return;
  }

  const preview = `<strong>Trabajador:</strong> ${s.display}<br><strong>Acción:</strong> Salida<br><strong>Hora salida:</strong> ${hora}<br><strong>Duración:</strong> ${calcHoras(registro.entrada, hora)}`;
  const confirmado = await mostrarGuardar('¿Confirmar registro de salida?', preview);
  if (!confirmado) return;

  const { error } = await supabaseClient
    .from('asistencia')
    .update({ salida: hora })
    .eq('id', registro.id);

  if (error) { console.error(error); mostrarToast('Error al registrar salida.', 'error'); return; }

  await audit('add', `Salida registrada por colaborador: ${s.display} (${hora})`);
  mostrarToast(`✓ Salida registrada. Duración: ${calcHoras(registro.entrada, hora)}.`, 'success');
  await renderColabAsistencia();
  await renderAsistencia();
});

/* ── Tabla de asistencias (admin ve todos + botón eliminar; colaborador ve todos sin eliminar) ── */
async function renderAsistencia() {
  const lista = await getAsistencias();
  const tbody = document.getElementById('bodyAsistencia');
  const empty = document.getElementById('emptyAsistencia');

  document.getElementById('totalAsistencias').textContent =
    `${lista.length} trabajador${lista.length !== 1 ? 'es' : ''} registrado${lista.length !== 1 ? 's' : ''}`;

  if (!lista.length) {
    tbody.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  tbody.innerHTML = lista.map((r, i) => `
    <tr class="${i === lista.length - 1 ? 'row-new' : ''}">
      <td>${i + 1}</td>
      <td>${r.nombre}</td>
      <td class="val-mono">${r.entrada}</td>
      <td class="val-mono">${r.salida || '<span style="color:var(--text-muted)">—</span>'}</td>
      <td class="val-mono">${calcHoras(r.entrada, r.salida)}</td>
      <td><span class="reg-by">${r.registrado_por || '—'}</span></td>
      <td>${isAdmin() ? `<button class="btn-delete" onclick="delAsistencia('${r.id}')">✕</button>` : ''}</td>
    </tr>`).join('');
}

/* ── Admin: eliminar asistencia ── */
async function delAsistencia(id) {
  if (!isAdmin()) return;

  const confirmado = await mostrarConfirm(
    '¿Eliminar registro?',
    'Se eliminará este registro de asistencia. Esta acción no se puede deshacer.',
    'Eliminar'
  );
  if (!confirmado) return;

  const lista = await getAsistencias();
  const reg   = lista.find(r => r.id === id);

  const { error } = await supabaseClient.from('asistencia').delete().eq('id', id);
  if (error) { console.error(error); mostrarToast('Error al eliminar el registro.', 'error'); return; }

  await audit('delete', `Asistencia eliminada: ${reg?.nombre || id}`);
  await renderAsistencia();
  mostrarToast('Registro eliminado.', 'info');
}

/* ── Toggle modo admin: entrada o salida ── */
document.querySelectorAll('input[name="accionAsistencia"]').forEach(r =>
  r.addEventListener('change', toggleAsistenciaMode));

function toggleAsistenciaMode() {
  if (!isAdmin()) return;
  const isEntrada = document.querySelector('input[name="accionAsistencia"]:checked').value === 'entrada';
  document.getElementById('groupSelectSalida').style.display           = isEntrada ? 'none'  : 'block';
  document.getElementById('groupNombreTrabajador').style.display       = isEntrada ? 'block' : 'none';
  document.getElementById('groupHoraEntrada').style.display            = isEntrada ? 'block' : 'none';
  document.getElementById('groupHoraSalida').style.display             = 'block';

  /* Actualizar estilo de tarjetas de acción */
  const labelEntrada = document.getElementById('labelAccionEntrada');
  const labelSalida  = document.getElementById('labelAccionSalida');
  if (labelEntrada) labelEntrada.style.opacity = isEntrada ? '1' : '0.7';
  if (labelSalida)  labelSalida.style.opacity  = isEntrada ? '0.7' : '1';

  if (!isEntrada) populateSelectSalida();
}

async function populateSelectSalida() {
  const select   = document.getElementById('selectTrabajadorSalida');
  const lista    = await getAsistencias();
  const filtered = lista.filter(r => r.entrada && !r.salida);
  select.innerHTML =
    '<option value="">— Selecciona —</option>' +
    filtered.map(r => `<option value="${r.id}">${r.nombre}</option>`).join('');
}

/* ── Admin: formulario completo de asistencia ── */
document.getElementById('formAsistencia').addEventListener('submit', async function (e) {
  e.preventDefault();
  if (!isAdmin()) { mostrarToast('Sin permisos para registrar asistencia.', 'error'); return; }

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

    const s   = getSession();
    const hoy = getTodayStr();

    /* Verificar si ya existe entrada para ese trabajador hoy */
    const lista    = await getAsistencias();
    const yaExiste = lista.find(r => r.nombre.toLowerCase() === nom.value.trim().toLowerCase());
    if (yaExiste) {
      mostrarToast(`Ya existe un registro para ${nom.value.trim()} hoy.`, 'error');
      return;
    }

    const preview = `
      <strong>Trabajador:</strong> ${nom.value.trim()}<br>
      <strong>Hora entrada:</strong> ${ent.value}${sal.value ? `<br><strong>Hora salida:</strong> ${sal.value}` : ''}<br>
      <strong>Fecha:</strong> ${hoy}<br>
      <strong>Registrado por:</strong> ${s?.display || '—'}
    `;
    const confirmado = await mostrarGuardar('¿Confirmar registro de entrada?', preview);
    if (!confirmado) return;

    const nuevo = {
      nombre:         nom.value.trim(),
      entrada:        ent.value,
      salida:         sal.value || null,
      registrado_por: s?.display || '—',
      fecha:          hoy
    };

    const { error } = await supabaseClient.from('asistencia').insert(nuevo);
    if (error) { console.error(error); mostrarToast('Error al guardar la asistencia.', 'error'); return; }

    await audit('add', `Asistencia registrada (admin): ${nuevo.nombre} (${nuevo.entrada}–${nuevo.salida || 'sin salida'})`);
    await renderAsistencia();
    mostrarToast(`✓ Asistencia de ${nuevo.nombre} registrada.`, 'success');
    this.reset();
    toggleAsistenciaMode();

  } else {
    /* SALIDA (admin) */
    const select = document.getElementById('selectTrabajadorSalida');
    const sal    = document.getElementById('horaSalida');
    clearErrors(['err-select', 'err-salida'], [select, sal]);

    let ok = true;
    if (!select.value) { setError('err-select', select, 'Selecciona un trabajador.'); ok = false; }
    if (!sal.value)    { setError('err-salida', sal, 'Ingresa la hora de salida.');  ok = false; }
    if (!ok) return;

    const lista = await getAsistencias();
    const reg   = lista.find(r => r.id === select.value);
    if (!reg) { mostrarToast('Registro no encontrado.', 'error'); return; }
    if (reg.salida) { mostrarToast('Este trabajador ya tiene salida registrada.', 'error'); return; }
    if (sal.value === reg.entrada) {
      setError('err-salida', sal, 'Salida no puede ser igual a entrada.');
      return;
    }

    const preview = `
      <strong>Trabajador:</strong> ${reg.nombre}<br>
      <strong>Hora salida:</strong> ${sal.value}<br>
      <strong>Duración:</strong> ${calcHoras(reg.entrada, sal.value)}
    `;
    const confirmado = await mostrarGuardar('¿Confirmar registro de salida?', preview);
    if (!confirmado) return;

    const { error } = await supabaseClient
      .from('asistencia').update({ salida: sal.value }).eq('id', select.value);

    if (error) { console.error(error); mostrarToast('Error al registrar la salida.', 'error'); return; }

    await audit('add', `Salida registrada (admin): ${reg.nombre} (${sal.value})`);
    await renderAsistencia();
    mostrarToast(`✓ Salida de ${reg.nombre} registrada.`, 'success');
    this.reset();
    toggleAsistenciaMode();
  }
});

/* ── Limpiar todas las asistencias del día (solo admin) ── */
document.getElementById('clearAsistencia').addEventListener('click', async () => {
  if (!isAdmin()) return;
  const confirmado = await mostrarConfirm(
    '¿Limpiar todos los registros?',
    'Se eliminarán todos los registros de asistencia de hoy. Esta acción no se puede deshacer.',
    'Limpiar todo'
  );
  if (!confirmado) return;

  const hoy = getTodayStr();
  const { error } = await supabaseClient.from('asistencia').delete().eq('fecha', hoy);
  if (error) { console.error(error); mostrarToast('Error al limpiar asistencias.', 'error'); return; }
  await audit('clear', 'Todos los registros de asistencia del día eliminados');
  await renderAsistencia();
  mostrarToast('Registros del día eliminados.', 'info');
});

/* ══════════════════════════════════════════════
   7. VENTAS POR MES
   ══════════════════════════════════════════════ */

async function getMeses() {
  const { data, error } = await supabaseClient
    .from('meses').select('*').order('nombre', { ascending: true });
  if (error) { console.error(error); return []; }
  return data || [];
}

async function getDias(mesId) {
  const { data, error } = await supabaseClient
    .from('dias').select('*').eq('mes_id', mesId).order('fecha', { ascending: true });
  if (error) { console.error(error); return []; }
  return data || [];
}

function getMesActivo() {
  return document.getElementById('mesSelector').value;
}

async function renderSelectMeses() {
  const sel   = document.getElementById('mesSelector');
  const prev  = sel.value;
  const meses = await getMeses();
  sel.innerHTML = meses.length
    ? meses.map(m => `<option value="${m.id}">${m.nombre}</option>`).join('')
    : '<option value="">— Sin meses creados —</option>';
  if (prev && meses.find(m => m.id === prev)) sel.value = prev;
  else if (meses.length) sel.value = meses[meses.length - 1].id;
}

async function renderVentas() {
  const mesId = getMesActivo();
  const meses = await getMeses();
  const mes   = meses.find(m => m.id === mesId);

  if (isAdmin()) {
    document.getElementById('labelMesActual').textContent =
      mes ? `DÍAS REGISTRADOS — ${mes.nombre.toUpperCase()}` : 'DÍAS REGISTRADOS';
  }

  const lista = mesId ? await getDias(mesId) : [];

  if (isAdmin()) {
    /* Admin: renderizar tabla y tarjetas */
    const tbody = document.getElementById('bodyVentas');
    const empty = document.getElementById('emptyVentas');

    if (!lista.length) {
      tbody.innerHTML = '';
      empty.classList.remove('hidden');
      actualizarReporte([]);
      return;
    }
    empty.classList.add('hidden');

    tbody.innerHTML = lista.map((d, i) => {
      const totalBruto = (d.efectivo || 0) + (d.yape || 0) + (d.plin || 0);
      const gastos     = d.transf || 0;
      const totalNeto  = totalBruto - gastos;
      const ganancia   = d.ganancia || 0;
      const balance    = totalNeto - ganancia;
      const clsGan     = ganancia >= 0 ? 'val-ganancia' : 'val-negativo';
      const pctGan     = fmtPct(ganancia, totalNeto);
      const fechaFmt   = new Date(d.fecha + 'T12:00:00').toLocaleDateString('es-PE',
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
          <td><button class="btn-delete" onclick="delDia('${mesId}','${d.id}')">✕</button></td>
        </tr>`;
    }).join('');

    actualizarReporte(lista);
  }
  /* Colaboradores: no ven tabla — nada más que hacer */
}

function actualizarReporte(lista) {
  if (!isAdmin()) return;
  const totalE     = lista.reduce((a, d) => a + (d.efectivo || 0), 0);
  const totalY     = lista.reduce((a, d) => a + (d.yape     || 0), 0);
  const totalP     = lista.reduce((a, d) => a + (d.plin     || 0), 0);
  const totalT     = lista.reduce((a, d) => a + (d.transf   || 0), 0);
  const totalBruto = totalE + totalY + totalP;
  const totalNeto  = totalBruto - totalT;
  const totalG     = lista.reduce((a, d) => a + (d.ganancia || 0), 0);
  const totalB     = totalNeto - totalG;

  document.getElementById('reporteEfectivo').textContent      = fmt(totalE);
  document.getElementById('reporteYape').textContent           = fmt(totalY);
  document.getElementById('reportePlin').textContent           = fmt(totalP);
  document.getElementById('reporteTransf').textContent         = fmt(totalT);
  document.getElementById('reporteTotalBruto').textContent     = fmt(totalBruto);
  document.getElementById('reporteTotalVentas').textContent    = fmt(totalNeto);
  document.getElementById('reporteCostoTotal').textContent     = fmt(totalG);
  document.getElementById('reporteGananciaTotal').textContent  = fmt(totalB);
  document.getElementById('reporteDias').textContent           = lista.length;

  document.getElementById('reporteGananciaTotal').style.color =
    totalB >= 0 ? 'var(--success)' : 'var(--danger)';
}

/* ── Eliminar día individual por id (admin) ── */
async function delDia(mesId, id) {
  if (!isAdmin()) return;

  const confirmado = await mostrarConfirm(
    '¿Eliminar este día?',
    'Se eliminará permanentemente el registro de este día del mes activo.',
    'Eliminar'
  );
  if (!confirmado) return;

  const lista = await getDias(mesId);
  const reg   = lista.find(d => d.id === id);

  const { error } = await supabaseClient.from('dias').delete().eq('id', id);
  if (error) { console.error(error); mostrarToast('Error al eliminar el día.', 'error'); return; }

  const totalBruto = (reg?.efectivo || 0) + (reg?.yape || 0) + (reg?.plin || 0);
  const gastos     = reg?.transf || 0;
  const totalNeto  = totalBruto - gastos;
  await audit('delete', `Día eliminado: ${reg?.fecha} — Total neto: ${fmt(totalNeto)}`);
  await renderVentas();
  await renderSelectMesesDescargas();
  mostrarToast('Día eliminado.', 'info');
}

/* ── Preview en tiempo real ── */
function actualizarPreview() {
  const e = parseFloat(document.getElementById('ventaEfectivo').value) || 0;
  const y = parseFloat(document.getElementById('ventaYape').value)     || 0;
  const p = parseFloat(document.getElementById('ventaPlin').value)     || 0;
  const t = parseFloat(document.getElementById('ventaTransf').value)   || 0;
  const g = parseFloat(document.getElementById('gananciaDelDia').value) || 0;

  const totalBruto = e + y + p;
  const totalNeto  = totalBruto - t;
  const balance    = totalNeto - g;

  document.getElementById('previewEfectivo').textContent   = fmt(e);
  document.getElementById('previewYapeVal').textContent    = fmt(y);
  document.getElementById('previewPlinVal').textContent    = fmt(p);
  document.getElementById('previewTransfVal').textContent  = fmt(t);
  document.getElementById('previewTotalBruto').textContent = fmt(totalBruto);
  document.getElementById('previewTotal').textContent      = fmt(totalNeto);
  document.getElementById('previewGanancia').textContent   = fmt(g);
  document.getElementById('previewBalance').textContent    = fmt(balance);
  document.getElementById('previewGanancia').style.color   =
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

  /* FIX CRÍTICO: capturar mesId ANTES de cualquier await */
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

  const tb = eNum + yNum + pNum;
  const tn = tb - tNum;

  const meses = await getMeses();
  const mesActual = meses.find(m => m.id === mesId);
  if (!mesActual) { mostrarToast('El mes seleccionado no existe. Recarga la página.', 'error'); return; }

  const lista  = await getDias(mesId);
  const existe = lista.find(d => d.fecha === fec.value);

  const s = getSession();

  if (existe) {
    if (!isAdmin()) {
      mostrarToast('Ya existe un registro para esa fecha. Solo el administrador puede modificarlo.', 'error');
      return;
    }

    const confirmado = await mostrarConfirm(
      `¿Sobreescribir ${fec.value}?`,
      `Ya existe un registro para esta fecha en el mes "${mesActual.nombre}". ¿Deseas reemplazarlo?`,
      'Sobreescribir'
    );
    if (!confirmado) return;

    const { error } = await supabaseClient
      .from('dias')
      .update({ efectivo: eNum, yape: yNum, plin: pNum, transf: tNum, ganancia: gNum, registrado_por: s?.display || '—' })
      .eq('id', existe.id);

    if (error) { console.error(error); mostrarToast('Error al actualizar el día.', 'error'); return; }

    await audit('add',
      `Día sobreescrito: ${fec.value} [Mes: ${mesActual.nombre}] — Efectivo:${fmt(eNum)} Yape:${fmt(yNum)} Plin:${fmt(pNum)} Gastos:${fmt(tNum)} Total neto:${fmt(tn)} Ganancia:${fmt(gNum)}`
    );

  } else {
    /* NUEVO DÍA: confirmar antes de insertar */
    const preview = `
      <strong>Mes:</strong> ${mesActual.nombre}<br>
      <strong>Fecha:</strong> ${fec.value}<br>
      <strong>Efectivo:</strong> ${fmt(eNum)} &nbsp; <strong>Yape:</strong> ${fmt(yNum)} &nbsp; <strong>Plin:</strong> ${fmt(pNum)}<br>
      <strong>Gastos:</strong> ${fmt(tNum)}<br>
      <strong>Total bruto:</strong> ${fmt(tb)} &nbsp; <strong>Total neto:</strong> ${fmt(tn)}<br>
      <strong>Ganancia:</strong> ${fmt(gNum)}<br>
      <strong>Registrado por:</strong> ${s?.display || '—'}
    `;

    const confirmado = await mostrarGuardar('¿Confirmar registro del día?', preview);
    if (!confirmado) return;

    const nuevoDia = {
      mes_id:         mesId,   /* FIX: mesId capturado antes de cualquier await */
      fecha:          fec.value,
      efectivo:       eNum,
      yape:           yNum,
      plin:           pNum,
      transf:         tNum,
      ganancia:       gNum,
      registrado_por: s?.display || '—'
    };

    const { error } = await supabaseClient.from('dias').insert(nuevoDia);
    if (error) { console.error(error); mostrarToast('Error al guardar el día.', 'error'); return; }

    await audit('add',
      `Día registrado: ${fec.value} [Mes: ${mesActual.nombre}] — Efectivo:${fmt(eNum)} Yape:${fmt(yNum)} Plin:${fmt(pNum)} Gastos:${fmt(tNum)} Total neto:${fmt(tn)} Ganancia:${fmt(gNum)}`
    );

    /* Para colaboradores: mostrar mensaje de éxito visible */
    if (!isAdmin()) {
      document.getElementById('cardColabVentasMsg').classList.remove('hidden');
    }
  }

  await renderVentas();
  if (isAdmin()) await renderSelectMesesDescargas();
  mostrarToast('✓ Día guardado correctamente.', 'success');
  this.reset();
  actualizarPreview();

  const hoy = new Date();
  document.getElementById('fechaVenta').value =
    `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-${String(hoy.getDate()).padStart(2,'0')}`;
});

/* ── Limpiar todos los días de un mes (solo admin) ── */
document.getElementById('clearDia').addEventListener('click', async () => {
  if (!isAdmin()) return;
  const mesId = getMesActivo();
  if (!mesId) { mostrarToast('No hay mes seleccionado.', 'error'); return; }
  const meses = await getMeses();
  const mes   = meses.find(m => m.id === mesId);

  const confirmado = await mostrarConfirm(
    `¿Limpiar el mes "${mes?.nombre}"?`,
    'Se eliminarán todos los días registrados de este mes. Esta acción no se puede deshacer.',
    'Limpiar mes'
  );
  if (!confirmado) return;

  const { error } = await supabaseClient.from('dias').delete().eq('mes_id', mesId);
  if (error) { console.error(error); mostrarToast('Error al limpiar el mes.', 'error'); return; }
  await audit('clear', `Mes limpiado: ${mes?.nombre}`);
  await renderVentas();
  await renderSelectMesesDescargas();
  mostrarToast('Mes limpiado.', 'info');
});

document.getElementById('mesSelector').addEventListener('change', async () => {
  await renderVentas();
  if (isAdmin()) await renderSelectMesesDescargas();
});

/* ── Limpiar auditoría (solo admin) ── */
document.getElementById('clearAuditoria').addEventListener('click', async () => {
  if (!isAdmin()) return;
  const confirmado = await mostrarConfirm(
    '¿Eliminar historial de auditoría?',
    'Se borrará todo el registro de acciones del sistema. Esta operación es irreversible.',
    'Eliminar historial'
  );
  if (!confirmado) return;

  await audit('clear', 'Historial de auditoría limpiado');
  const { error } = await supabaseClient.from('auditoria').delete().neq('id', 'dummy');
  if (error) { console.error(error); mostrarToast('Error al limpiar auditoría.', 'error'); return; }
  await renderAuditoria();
  mostrarToast('Historial limpiado.', 'info');
});

/* ══════════════════════════════════════════════
   8. MODAL — NUEVO MES
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
document.getElementById('modalCerrar').addEventListener('click',   () => overlay.classList.remove('active'));
overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('active'); });

document.getElementById('modalConfirmar').addEventListener('click', async () => {
  const nombre = inputMes.value.trim();
  const errEl  = document.getElementById('err-mes');
  inputMes.classList.remove('input-error');
  errEl.textContent = '';

  if (!nombre || nombre.length < 2) {
    errEl.textContent = 'Mínimo 2 caracteres.';
    inputMes.classList.add('input-error');
    return;
  }

  const meses = await getMeses();
  if (meses.find(m => m.nombre.toLowerCase() === nombre.toLowerCase())) {
    errEl.textContent = 'Ya existe un mes con ese nombre.';
    inputMes.classList.add('input-error');
    return;
  }

  const nuevoMes = { id: uid(), nombre };
  const { error } = await supabaseClient.from('meses').insert(nuevoMes);
  if (error) { console.error(error); mostrarToast('Error al crear el mes.', 'error'); return; }

  await renderSelectMeses();
  if (isAdmin()) await renderSelectMesesDescargas();
  document.getElementById('mesSelector').value = nuevoMes.id;
  await renderVentas();
  await audit('add', `Nuevo mes creado: ${nombre}`);
  overlay.classList.remove('active');
  mostrarToast(`✓ Mes "${nombre}" creado correctamente.`, 'success');
});

inputMes.addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('modalConfirmar').click();
  if (e.key === 'Escape') overlay.classList.remove('active');
});

/* ══════════════════════════════════════════════
   9. PERMISOS
   ══════════════════════════════════════════════ */
function updateFieldPermissions() {
  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.style.display = isAdmin() ? 'inline-flex' : 'none';
  });
}

/* ══════════════════════════════════════════════
   10. DESCARGAS — Exportar a Excel con SheetJS
       Requiere reautenticación de admin
   ══════════════════════════════════════════════ */
function exportarExcel(filename, sheetName, headers, rows) {
  if (typeof XLSX === 'undefined') {
    mostrarToast('Error: librería Excel no cargada.', 'error');
    return;
  }

  const wsData = [headers, ...rows];
  const ws     = XLSX.utils.aoa_to_sheet(wsData);

  const colWidths = headers.map((h, i) => {
    const maxLen = Math.max(
      String(h).length,
      ...rows.map(r => String(r[i] ?? '').length)
    );
    return { wch: Math.min(maxLen + 4, 40) };
  });
  ws['!cols'] = colWidths;

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
  if (!isAdmin()) return;
  const sel   = document.getElementById('selectMesVentasDescargas');
  const meses = await getMeses();
  sel.innerHTML = meses.length
    ? meses.map(m => `<option value="${m.id}">${m.nombre}</option>`).join('')
    : '<option value="">— Sin meses creados —</option>';
  if (meses.length > 0) sel.value = meses[meses.length - 1].id;
}

/* ── Descargar ventas (requiere reauth) ── */
document.getElementById('btnDescargarVentas').addEventListener('click', async () => {
  if (!isAdmin()) { mostrarToast('Solo el administrador puede exportar datos.', 'error'); return; }

  const autenticado = await mostrarReauth();
  if (!autenticado) return;

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

  const rows   = [];
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
      +(d.yape     || 0).toFixed(2),
      +(d.plin     || 0).toFixed(2),
      +(d.transf   || 0).toFixed(2),
      +bruto.toFixed(2), +neto.toFixed(2),
      +gan.toFixed(2), +balance.toFixed(2),
      margen, d.registrado_por || '—'
    ]);
  });

  const totalE     = dias.reduce((a, d) => a + (d.efectivo || 0), 0);
  const totalY     = dias.reduce((a, d) => a + (d.yape     || 0), 0);
  const totalP     = dias.reduce((a, d) => a + (d.plin     || 0), 0);
  const totalT     = dias.reduce((a, d) => a + (d.transf   || 0), 0);
  const totalBruto = totalE + totalY + totalP;
  const totalNeto  = totalBruto - totalT;
  const totalG     = dias.reduce((a, d) => a + (d.ganancia || 0), 0);
  const totalB     = totalNeto - totalG;

  rows.push([]);
  rows.push([
    'TOTAL', '',
    +totalE.toFixed(2), +totalY.toFixed(2), +totalP.toFixed(2), +totalT.toFixed(2),
    +totalBruto.toFixed(2), +totalNeto.toFixed(2),
    +totalG.toFixed(2), +totalB.toFixed(2),
    totalNeto > 0 ? ((totalG / totalNeto) * 100).toFixed(1) + '%' : '0%', ''
  ]);

  const fecha = new Date();
  const nombreArchivo = `Ventas_${mes.nombre}_${fecha.getFullYear()}-${String(fecha.getMonth()+1).padStart(2,'0')}-${String(fecha.getDate()).padStart(2,'0')}`;
  exportarExcel(nombreArchivo, mes.nombre, headers, rows);
  await audit('add', `Exportación Excel de ventas: ${mes.nombre}`);
  mostrarToast('✓ Reporte de ventas descargado.', 'success');
});

/* ── Descargar asistencias (requiere reauth) ── */
document.getElementById('btnDescargarAsistencias').addEventListener('click', async () => {
  if (!isAdmin()) { mostrarToast('Solo el administrador puede exportar datos.', 'error'); return; }

  const autenticado = await mostrarReauth();
  if (!autenticado) return;

  const asistencias = await getAsistencias();
  if (!asistencias.length) { mostrarToast('No hay asistencias para descargar hoy.', 'info'); return; }

  const headers = ['#', 'Trabajador', 'Hora Entrada', 'Hora Salida', 'Duración', 'Registrado por'];

  const rows = asistencias
    .sort((a, b) => {
      if (a.entrada !== b.entrada) return a.entrada.localeCompare(b.entrada);
      return a.nombre.localeCompare(b.nombre);
    })
    .map((r, i) => [
      i + 1, r.nombre, r.entrada, r.salida || '—',
      calcHoras(r.entrada, r.salida), r.registrado_por || '—'
    ]);

  const fecha = new Date();
  const nombreArchivo = `Asistencias_${fecha.getFullYear()}-${String(fecha.getMonth()+1).padStart(2,'0')}-${String(fecha.getDate()).padStart(2,'0')}`;
  exportarExcel(nombreArchivo, 'Asistencias', headers, rows);
  await audit('add', `Exportación Excel de asistencias del ${fecha.toLocaleDateString('es-PE')}`);
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

  /* Setear fecha de hoy en el formulario de ventas */
  const hoy = new Date();
  document.getElementById('fechaVenta').value =
    `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-${String(hoy.getDate()).padStart(2,'0')}`;
})();
