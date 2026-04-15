/* ================================================
   script.js — KRD Importaciones v9
   NUEVAS FUNCIONES:
   ✔ Panel de Observaciones de Mercadería
   ✔ Colaboradores envían observaciones
   ✔ Admin recibe mensaje WhatsApp automático (CallMeBot)
   ✔ Admin marca observaciones como leídas
   ✔ Badge contador de no leídas en pestaña
   ================================================ */

const SUPABASE_URL = "https://vbphssxbfuthmkcldnkb.supabase.co";
const SUPABASE_KEY = "sb_publishable_abwXhuRC0foLsmBMwUso5g_ZCnhWmqS";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/* ── CallMeBot WhatsApp Config ── */
const WA_PHONE = "51993100282";
const WA_APIKEY = "3956084";

const SK_SESSION = "krd_session";
const SK_LOGIN_FAILS = "krd_login_fails";
const SK_LOGIN_BLOCK = "krd_login_blocked_until";
const MAX_LOGIN_TRIES = 5;
const BLOCK_MS = 2 * 60 * 1000;

function getSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SK_SESSION));
  } catch {
    return null;
  }
}
function setSession(u) {
  sessionStorage.setItem(SK_SESSION, JSON.stringify(u));
}
function clearSession() {
  sessionStorage.removeItem(SK_SESSION);
}
function isAdmin() {
  const s = getSession();
  return s && s.role === "admin";
}

/* ── Reloj hora peruana (UTC-5) ── */
let _clockInterval = null;
function iniciarRelojPeru() {
  if (_clockInterval) clearInterval(_clockInterval);
  function tick() {
    const ahora = new Date();
    // Hora de Perú = UTC - 5
    const utcMs = ahora.getTime() + ahora.getTimezoneOffset() * 60000;
    const peruMs = utcMs - 5 * 3600000;
    const peru = new Date(peruMs);
    const hh = String(peru.getHours()).padStart(2, "0");
    const mm = String(peru.getMinutes()).padStart(2, "0");
    const ss = String(peru.getSeconds()).padStart(2, "0");
    const el = document.getElementById("headerClock");
    if (el) el.textContent = `🕐 ${hh}:${mm}:${ss} (PE)`;
  }
  tick();
  _clockInterval = setInterval(tick, 1000);
}


function getLoginFails() {
  return parseInt(localStorage.getItem(SK_LOGIN_FAILS) || "0", 10);
}
function incrementLoginFails() {
  localStorage.setItem(SK_LOGIN_FAILS, getLoginFails() + 1);
}
function resetLoginFails() {
  localStorage.removeItem(SK_LOGIN_FAILS);
  localStorage.removeItem(SK_LOGIN_BLOCK);
}
function isLoginBlocked() {
  const until = parseInt(localStorage.getItem(SK_LOGIN_BLOCK) || "0", 10);
  if (Date.now() < until) return true;
  if (until && Date.now() >= until) {
    localStorage.removeItem(SK_LOGIN_BLOCK);
    localStorage.removeItem(SK_LOGIN_FAILS);
  }
  return false;
}
function blockLogin() {
  localStorage.setItem(SK_LOGIN_BLOCK, Date.now() + BLOCK_MS);
}
function getBlockSecondsLeft() {
  const until = parseInt(localStorage.getItem(SK_LOGIN_BLOCK) || "0", 10);
  return Math.max(0, Math.ceil((until - Date.now()) / 1000));
}

/* ── Sanitizar XSS ── */
function sanitize(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/* ══════════════════════════════════════════════
   2. AUDITORÍA
   ══════════════════════════════════════════════ */
async function getAudit() {
  const { data, error } = await supabaseClient
    .from("auditoria")
    .select("*")
    .order("fecha", { ascending: false })
    .limit(500);
  if (error) {
    console.error(error);
    return [];
  }
  return data || [];
}

async function audit(tipo, detalle) {
  const s = getSession();
  const entry = {
    fecha: new Date().toISOString(),
    usuario: s ? s.username : "—",
    rol: s ? s.role : "—",
    tipo,
    detalle,
  };
  const { error } = await supabaseClient.from("auditoria").insert(entry);
  if (error) console.error("Audit error:", error);
}

async function renderAuditoria() {
  if (!isAdmin()) return;
  const lista = await getAudit();
  const tbody = document.getElementById("bodyAuditoria");
  const empty = document.getElementById("emptyAuditoria");

  if (!lista.length) {
    tbody.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  const claseMap = {
    login: "audit-login",
    logout: "audit-logout",
    add: "audit-add",
    delete: "audit-delete",
    clear: "audit-clear",
  };
  const labelMap = {
    login: "LOGIN",
    logout: "LOGOUT",
    add: "REGISTRO",
    delete: "ELIMINACIÓN",
    clear: "LIMPIEZA",
  };

  tbody.innerHTML = lista
    .map((e, i) => {
      const fecha = new Date(e.fecha).toLocaleString("es-PE");
      return `
      <tr>
        <td>${i + 1}</td>
        <td class="val-mono" style="font-size:0.75rem">${sanitize(fecha)}</td>
        <td>${sanitize(e.usuario)}</td>
        <td><span class="role-tag ${e.rol === "employee" ? "role-employee" : ""}">${e.rol === "admin" ? "Admin" : "Colaborador"}</span></td>
        <td><span class="audit-action ${claseMap[e.tipo] || ""}">${labelMap[e.tipo] || sanitize(e.tipo)}</span></td>
        <td style="color:var(--text-secondary);font-size:0.8rem">${sanitize(e.detalle)}</td>
      </tr>`;
    })
    .join("");
}

/* ══════════════════════════════════════════════
   3. UTILIDADES
   ══════════════════════════════════════════════ */
function mostrarToast(msg, tipo = "success") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = `toast show toast-${tipo}`;
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove("show"), 3500);
}

function fmt(n) {
  return (
    "S/ " +
    Number(n)
      .toFixed(2)
      .replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  );
}
function fmtPct(v, t) {
  if (!t || t === 0) return "0%";
  return ((v / t) * 100).toFixed(1) + "%";
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}
function calcHoras(e, s) {
  if (!e || !s) return "—";
  const [hE, mE] = e.split(":").map(Number);
  const [hS, mS] = s.split(":").map(Number);
  let min = hS * 60 + mS - (hE * 60 + mE);
  if (min < 0) min += 1440;
  return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, "0")}m`;
}
function setError(idMsg, input, msg) {
  const el = document.getElementById(idMsg);
  if (el) el.textContent = msg;
  if (input) input.classList.add("input-error");
}
function clearErrors(ids, inputs = []) {
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = "";
  });
  inputs.forEach((i) => i && i.classList.remove("input-error"));
}
function getTodayStr() {
  const now = new Date();
  // Usar hora local de Perú (UTC-5) para que no cambie de día a las 7pm UTC
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function getNowTimeStr() {
  const n = new Date();
  return `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
}

/* ══════════════════════════════════════════════
   4. MODALES
   ══════════════════════════════════════════════ */
function mostrarConfirm(titulo, descripcion, labelConfirmar = "Confirmar") {
  return new Promise((resolve) => {
    document.getElementById("confirmTitle").textContent = titulo;
    document.getElementById("confirmDesc").textContent = descripcion;
    document.getElementById("confirmAceptar").textContent = labelConfirmar;
    const overlay = document.getElementById("modalConfirmOverlay");
    overlay.classList.add("active");
    const onAceptar = () => {
      overlay.classList.remove("active");
      cleanup();
      resolve(true);
    };
    const onCancelar = () => {
      overlay.classList.remove("active");
      cleanup();
      resolve(false);
    };
    const cleanup = () => {
      document
        .getElementById("confirmAceptar")
        .removeEventListener("click", onAceptar);
      document
        .getElementById("confirmCancelar")
        .removeEventListener("click", onCancelar);
    };
    document
      .getElementById("confirmAceptar")
      .addEventListener("click", onAceptar);
    document
      .getElementById("confirmCancelar")
      .addEventListener("click", onCancelar);
  });
}

function mostrarGuardar(descripcion, previewHtml) {
  return new Promise((resolve) => {
    document.getElementById("guardarDesc").textContent = descripcion;
    document.getElementById("guardarPreviewBox").innerHTML = previewHtml;
    const overlay = document.getElementById("modalGuardarOverlay");
    overlay.classList.add("active");
    const onAceptar = () => {
      overlay.classList.remove("active");
      cleanup();
      resolve(true);
    };
    const onCancelar = () => {
      overlay.classList.remove("active");
      cleanup();
      resolve(false);
    };
    const cleanup = () => {
      document
        .getElementById("guardarAceptar")
        .removeEventListener("click", onAceptar);
      document
        .getElementById("guardarCancelar")
        .removeEventListener("click", onCancelar);
    };
    document
      .getElementById("guardarAceptar")
      .addEventListener("click", onAceptar);
    document
      .getElementById("guardarCancelar")
      .addEventListener("click", onCancelar);
  });
}

function mostrarReauth() {
  return new Promise((resolve) => {
    const overlay = document.getElementById("modalReauthOverlay");
    const inputPass = document.getElementById("reauthPass");
    const errEl = document.getElementById("err-reauth");
    inputPass.value = "";
    errEl.textContent = "";
    inputPass.classList.remove("input-error");
    overlay.classList.add("active");
    setTimeout(() => inputPass.focus(), 80);
    const onAceptar = async () => {
      const pass = inputPass.value.trim();
      if (!pass) {
        errEl.textContent = "Ingresa tu contraseña.";
        inputPass.classList.add("input-error");
        return;
      }
      const s = getSession();
      if (!s || s.role !== "admin") {
        errEl.textContent = "No tienes permisos de administrador.";
        return;
      }
      const { error } = await supabaseClient.auth.signInWithPassword({
        email: s.email,
        password: pass,
      });
      if (error) {
        errEl.textContent = "Contraseña incorrecta.";
        inputPass.classList.add("input-error");
        inputPass.value = "";
        inputPass.focus();
        return;
      }
      overlay.classList.remove("active");
      cleanup();
      resolve(true);
    };
    const onCancelar = () => {
      overlay.classList.remove("active");
      cleanup();
      resolve(false);
    };
    const onCerrar = () => {
      overlay.classList.remove("active");
      cleanup();
      resolve(false);
    };
    const onKeydown = (e) => {
      if (e.key === "Enter") onAceptar();
      if (e.key === "Escape") onCancelar();
    };
    const cleanup = () => {
      document
        .getElementById("reauthAceptar")
        .removeEventListener("click", onAceptar);
      document
        .getElementById("reauthCancelar")
        .removeEventListener("click", onCancelar);
      document
        .getElementById("reauthCerrar")
        .removeEventListener("click", onCerrar);
      inputPass.removeEventListener("keydown", onKeydown);
    };
    document
      .getElementById("reauthAceptar")
      .addEventListener("click", onAceptar);
    document
      .getElementById("reauthCancelar")
      .addEventListener("click", onCancelar);
    document.getElementById("reauthCerrar").addEventListener("click", onCerrar);
    inputPass.addEventListener("keydown", onKeydown);
  });
}

function mostrarColabHoraModal(tipo) {
  return new Promise((resolve) => {
    const overlay = document.getElementById("modalColabHoraOverlay");
    const iconEl = document.getElementById("colabModalIcon");
    const titleEl = document.getElementById("colabModalTitle");
    const descEl = document.getElementById("colabModalDesc");
    const horaInput = document.getElementById("colabModalHora");
    const errEl = document.getElementById("err-colab-modal-hora");
    const esEntrada = tipo === "entrada";

    iconEl.className =
      "colab-modal-icon-wrap" + (esEntrada ? "" : " modal-icon-exit");
    iconEl.innerHTML = esEntrada
      ? `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>`
      : `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`;
    titleEl.textContent = esEntrada ? "Registrar entrada" : "Registrar salida";
    descEl.textContent = esEntrada
      ? "Confirma tu hora de entrada al trabajo."
      : "Confirma tu hora de salida del trabajo.";
    horaInput.value = getNowTimeStr();
    errEl.textContent = "";
    horaInput.classList.remove("input-error");
    overlay.classList.add("active");
    setTimeout(() => horaInput.focus(), 80);
    const onConfirmar = () => {
      const hora = horaInput.value.trim();
      if (!hora) {
        errEl.textContent = "Ingresa la hora.";
        horaInput.classList.add("input-error");
        return;
      }
      overlay.classList.remove("active");
      cleanup();
      resolve(hora);
    };
    const onCancelar = () => {
      overlay.classList.remove("active");
      cleanup();
      resolve(null);
    };
    const onKeydown = (e) => {
      if (e.key === "Enter") onConfirmar();
      if (e.key === "Escape") onCancelar();
    };
    const cleanup = () => {
      document
        .getElementById("colabModalConfirmar")
        .removeEventListener("click", onConfirmar);
      document
        .getElementById("colabModalCancelar")
        .removeEventListener("click", onCancelar);
      horaInput.removeEventListener("keydown", onKeydown);
    };
    document
      .getElementById("colabModalConfirmar")
      .addEventListener("click", onConfirmar);
    document
      .getElementById("colabModalCancelar")
      .addEventListener("click", onCancelar);
    horaInput.addEventListener("keydown", onKeydown);
  });
}

/* Modal confirmación observación enviada */
function mostrarObsConfirm(texto, nombreColab) {
  return new Promise((resolve) => {
    const overlay = document.getElementById("modalObsConfirmOverlay");
    const desc = document.getElementById("obsConfirmDesc");
    const preview = document.getElementById("obsConfirmPreview");
    desc.textContent =
      "Tu observación fue guardada y enviada al administrador por WhatsApp.";
    preview.innerHTML = `
      <strong>Colaborador:</strong> ${sanitize(nombreColab)}<br>
      <strong>Fecha:</strong> ${new Date().toLocaleString("es-PE")}<br>
      <strong>Mensaje:</strong> ${sanitize(texto)}
    `;
    overlay.classList.add("active");
    const btn = document.getElementById("obsConfirmOk");
    const onOk = () => {
      overlay.classList.remove("active");
      btn.removeEventListener("click", onOk);
      resolve();
    };
    btn.addEventListener("click", onOk);
  });
}

/* ══════════════════════════════════════════════
   5. LOGIN / LOGOUT — Supabase Auth
   ══════════════════════════════════════════════ */
async function mostrarApp(session) {
  document.getElementById("loginScreen").classList.add("hidden");
  document.getElementById("appScreen").classList.remove("hidden");

  document.getElementById("userBadgeName").textContent = session.display;
  const roleTag = document.getElementById("userRoleTag");
  roleTag.textContent = session.role === "admin" ? "Admin" : "Colaborador";
  roleTag.className = `role-tag ${session.role === "employee" ? "role-employee" : ""}`;

  document
    .querySelectorAll(".tab-admin-only")
    .forEach((el) => el.classList.toggle("hidden", !isAdmin()));
  document
    .querySelectorAll(".admin-only")
    .forEach((el) => el.classList.toggle("hidden", !isAdmin()));
  document
    .querySelectorAll(".colab-only")
    .forEach((el) => el.classList.toggle("hidden", isAdmin()));

  document.getElementById("headerDate").textContent =
    new Date().toLocaleDateString("es-PE", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  iniciarRelojPeru();

  if (isAdmin()) {
    document.getElementById("asistAdminView").classList.remove("hidden");
    document.getElementById("formAsistencia").classList.remove("hidden");
    document.getElementById("asistColabView").classList.add("hidden");
    document.getElementById("cardTablaAsistencia").classList.remove("hidden");
    document.getElementById("cardTablaVentas").classList.remove("hidden");
    document.getElementById("reporteGrid").classList.remove("hidden");
    document.getElementById("cardColabVentasMsg").classList.add("hidden");

    activarTab("asistencia");
    await renderSelectMesesAsistencia();
    await renderAsistencia();
    toggleAsistenciaMode();
    await renderSelectMesesDescargas();
    await renderSelectMesesDescargasAsistencia();
    await actualizarBadgeObs();
  } else {
    document.getElementById("asistAdminView").classList.add("hidden");
    document.getElementById("formAsistencia").classList.add("hidden");
    document.getElementById("asistColabView").classList.remove("hidden");
    document.getElementById("cardTablaAsistencia").classList.remove("hidden");
    document.getElementById("cardTablaVentas").classList.add("hidden");
    document.getElementById("reporteGrid").classList.add("hidden");
    document.getElementById("cardColabVentasMsg").classList.add("hidden");

    activarTab("asistencia");
    await renderSelectMesesAsistencia();
    await renderColabAsistencia();
    await renderAsistencia();
  }

  await renderVentas();
  await renderSelectMeses();

  // Mostrar label "Observaciones" en tabla según rol
  const obsLabel = document.getElementById("obsTableLabel");
  if (obsLabel)
    obsLabel.textContent = isAdmin()
      ? "TODAS LAS OBSERVACIONES"
      : "MIS OBSERVACIONES";
}

function mostrarLogin() {
  document.getElementById("loginScreen").classList.remove("hidden");
  document.getElementById("appScreen").classList.add("hidden");
}

function activarTab(nombre) {
  document
    .querySelectorAll(".tab-btn")
    .forEach((b) => b.classList.toggle("active", b.dataset.tab === nombre));
  document
    .querySelectorAll(".tab-panel")
    .forEach((p) => p.classList.toggle("active", p.id === "tab-" + nombre));
}

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const tab = btn.dataset.tab;
    activarTab(tab);
    if (tab === "auditoria") await renderAuditoria();
    if (tab === "observaciones") await renderObservaciones();
  });
});

document
  .getElementById("formLogin")
  .addEventListener("submit", async function (e) {
    e.preventDefault();
    const userInput = document.getElementById("loginUser");
    const passInput = document.getElementById("loginPass");
    const errorBox = document.getElementById("loginErrorBox");

    clearErrors(["err-loginUser", "err-loginPass"], [userInput, passInput]);
    errorBox.classList.remove("show");

    if (isLoginBlocked()) {
      const secs = getBlockSecondsLeft();
      errorBox.textContent = `Demasiados intentos fallidos. Espera ${secs} segundos.`;
      errorBox.classList.add("show");
      return;
    }

    const user = userInput.value.trim();
    const pass = passInput.value;

    if (!user) {
      setError("err-loginUser", userInput, "Ingresa tu usuario.");
      return;
    }
    if (!pass) {
      setError("err-loginPass", passInput, "Ingresa tu contraseña.");
      return;
    }

    const { data: perfil, error: perfilErr } = await supabaseClient
      .from("perfiles")
      .select("email, username, display_name, rol")
      .ilike("username", user)
      .single();

    if (perfilErr || !perfil) {
      incrementLoginFails();
      if (getLoginFails() >= MAX_LOGIN_TRIES) {
        blockLogin();
        errorBox.textContent = `Cuenta bloqueada por ${BLOCK_MS / 60000} minutos por exceso de intentos.`;
      } else {
        errorBox.textContent = `Usuario o contraseña incorrectos. Intentos restantes: ${MAX_LOGIN_TRIES - getLoginFails()}`;
      }
      errorBox.classList.add("show");
      return;
    }

    const { data: authData, error: authErr } =
      await supabaseClient.auth.signInWithPassword({
        email: perfil.email,
        password: pass,
      });

    if (authErr || !authData?.user) {
      incrementLoginFails();
      if (getLoginFails() >= MAX_LOGIN_TRIES) {
        blockLogin();
        errorBox.textContent = `Cuenta bloqueada por ${BLOCK_MS / 60000} minutos.`;
      } else {
        errorBox.textContent = `Contraseña incorrecta. Intentos restantes: ${MAX_LOGIN_TRIES - getLoginFails()}`;
      }
      errorBox.classList.add("show");
      return;
    }

    resetLoginFails();
    const session = {
      uid: authData.user.id,
      email: perfil.email,
      username: perfil.username,
      display: perfil.display_name || perfil.username,
      role: perfil.rol,
    };
    setSession(session);
    await audit(
      "login",
      `Inicio de sesión: ${session.display} [${session.role}]`,
    );
    await mostrarApp(session);
  });

document.getElementById("togglePass").addEventListener("click", () => {
  const inp = document.getElementById("loginPass");
  inp.type = inp.type === "password" ? "text" : "password";
});

document.getElementById("btnLogout").addEventListener("click", async () => {
  const s = getSession();
  if (s) await audit("logout", `Cierre de sesión: ${s.display}`);
  clearSession();
  await supabaseClient.auth.signOut();
  mostrarLogin();
});

/* ══════════════════════════════════════════════
   6. MESES ASISTENCIA
   ══════════════════════════════════════════════ */
async function getMesesAsistencia() {
  const { data, error } = await supabaseClient
    .from("meses_asistencia")
    .select("*")
    .order("nombre", { ascending: true });
  if (error) {
    console.error(error);
    return [];
  }
  return data || [];
}

function getMesActivoAsistencia() {
  return document.getElementById("mesSelectorAsistencia").value;
}

async function renderSelectMesesAsistencia() {
  const sel = document.getElementById("mesSelectorAsistencia");
  const prev = sel.value;
  const meses = await getMesesAsistencia();
  sel.innerHTML = meses.length
    ? meses
        .map((m) => `<option value="${m.id}">${sanitize(m.nombre)}</option>`)
        .join("")
    : '<option value="">— Sin meses —</option>';
  if (prev && meses.find((m) => m.id === prev)) sel.value = prev;
  else if (meses.length) sel.value = meses[meses.length - 1].id;
}

const overlayAsist = document.getElementById("modalAsistMesOverlay");
const inputMesAsist = document.getElementById("inputNuevoMesAsist");

document.getElementById("btnNuevoMesAsist").addEventListener("click", () => {
  inputMesAsist.value = "";
  document.getElementById("err-mes-asist").textContent = "";
  inputMesAsist.classList.remove("input-error");
  overlayAsist.classList.add("active");
  setTimeout(() => inputMesAsist.focus(), 80);
});

document
  .getElementById("modalAsistMesCancelar")
  .addEventListener("click", () => overlayAsist.classList.remove("active"));
document
  .getElementById("modalAsistMesCerrar")
  .addEventListener("click", () => overlayAsist.classList.remove("active"));
overlayAsist.addEventListener("click", (e) => {
  if (e.target === overlayAsist) overlayAsist.classList.remove("active");
});

document
  .getElementById("modalAsistMesConfirmar")
  .addEventListener("click", async () => {
    const nombre = inputMesAsist.value.trim();
    const errEl = document.getElementById("err-mes-asist");
    inputMesAsist.classList.remove("input-error");
    errEl.textContent = "";
    if (!nombre || nombre.length < 2) {
      errEl.textContent = "Mínimo 2 caracteres.";
      inputMesAsist.classList.add("input-error");
      return;
    }
    const meses = await getMesesAsistencia();
    if (meses.find((m) => m.nombre.toLowerCase() === nombre.toLowerCase())) {
      errEl.textContent = "Ya existe un mes con ese nombre.";
      inputMesAsist.classList.add("input-error");
      return;
    }
    const nuevoMes = { id: uid(), nombre };
    const { error } = await supabaseClient
      .from("meses_asistencia")
      .insert(nuevoMes);
    if (error) {
      console.error(error);
      mostrarToast("Error al crear el mes de asistencia.", "error");
      return;
    }
    await renderSelectMesesAsistencia();
    await renderSelectMesesDescargasAsistencia();
    document.getElementById("mesSelectorAsistencia").value = nuevoMes.id;
    await renderAsistencia();
    await audit("add", `Nuevo mes de asistencia creado: ${nombre}`);
    overlayAsist.classList.remove("active");
    mostrarToast(`✓ Mes de asistencia "${nombre}" creado.`, "success");
  });

inputMesAsist?.addEventListener("keydown", (e) => {
  if (e.key === "Enter")
    document.getElementById("modalAsistMesConfirmar").click();
  if (e.key === "Escape") overlayAsist.classList.remove("active");
});

document
  .getElementById("mesSelectorAsistencia")
  ?.addEventListener("change", async () => {
    await renderAsistencia();
    if (!isAdmin()) await renderColabAsistencia();
    if (isAdmin()) await renderSelectMesesDescargasAsistencia();
  });

/* ══════════════════════════════════════════════
   7. ASISTENCIA
   ══════════════════════════════════════════════ */
async function getAsistencias() {
  const mesId = getMesActivoAsistencia();
  if (mesId) {
    const { data, error } = await supabaseClient
      .from("asistencia")
      .select("*")
      .eq("mes_asist_id", mesId)
      .order("fecha", { ascending: true })
      .order("entrada", { ascending: true });
    if (error) {
      console.error(error);
      return [];
    }
    return data || [];
  }
  const hoy = getTodayStr();
  const { data, error } = await supabaseClient
    .from("asistencia")
    .select("*")
    .eq("fecha", hoy)
    .order("entrada", { ascending: true });
  if (error) {
    console.error(error);
    return [];
  }
  return data || [];
}

async function getAsistenciasHoy() {
  const mesId = getMesActivoAsistencia();
  const hoy = getTodayStr();
  let query = supabaseClient.from("asistencia").select("*").eq("fecha", hoy);
  if (mesId) query = query.eq("mes_asist_id", mesId);
  const { data, error } = await query.order("entrada", { ascending: true });
  if (error) {
    console.error(error);
    return [];
  }
  return data || [];
}

async function getRegistroColabHoy() {
  const s = getSession();
  const hoy = getTodayStr();
  const mesId = getMesActivoAsistencia();
  let query = supabaseClient
    .from("asistencia")
    .select("*")
    .eq("fecha", hoy)
    .ilike("nombre", s.display);
  if (mesId) query = query.eq("mes_asist_id", mesId);
  const { data, error } = await query.limit(1);
  if (error) {
    console.error(error);
    return null;
  }
  return data && data.length ? data[0] : null;
}

async function renderColabAsistencia() {
  if (isAdmin()) return;
  const s = getSession();
  const statusEl = document.getElementById("colabAsistStatus");
  const btnEntrada = document.getElementById("btnColabEntrada");
  const btnSalida = document.getElementById("btnColabSalida");
  const registro = await getRegistroColabHoy();

  const headerNombre = document.getElementById("colabHeaderNombre");
  const headerFecha = document.getElementById("colabHeaderFecha");
  if (headerNombre) headerNombre.textContent = `Hola, ${s.display}`;
  if (headerFecha)
    headerFecha.textContent = new Date().toLocaleDateString("es-PE", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  if (!registro) {
    statusEl.className = "colab-asist-status colab-status--neutral";
    statusEl.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      Hola <strong>${sanitize(s.display)}</strong> — Aún no has registrado tu entrada hoy.`;
    btnEntrada.disabled = false;
    btnSalida.disabled = true;
    btnSalida.title = "Debes registrar tu entrada primero";
  } else if (registro.entrada && !registro.salida) {
    statusEl.className = "colab-asist-status colab-status--warn";
    statusEl.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
      Entrada registrada a las <strong>${sanitize(registro.entrada)}</strong> — Cuando termines, registra tu salida.`;
    btnEntrada.disabled = true;
    btnEntrada.title = "Ya registraste tu entrada hoy";
    btnSalida.disabled = false;
    btnSalida.title = "";
  } else if (registro.entrada && registro.salida) {
    statusEl.className = "colab-asist-status colab-status--ok";
    statusEl.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
      ¡Jornada completa! Entrada: <strong>${sanitize(registro.entrada)}</strong> · Salida: <strong>${sanitize(registro.salida)}</strong> · Total: <strong>${calcHoras(registro.entrada, registro.salida)}</strong>`;
    btnEntrada.disabled = true;
    btnSalida.disabled = true;
  }
}

document
  .getElementById("btnColabEntrada")
  .addEventListener("click", async () => {
    if (isAdmin()) return;
    const s = getSession();
    const mesId = getMesActivoAsistencia();
    if (!mesId) {
      mostrarToast(
        "No hay mes de asistencia activo. Contacta al administrador.",
        "error",
      );
      return;
    }
    const existente = await getRegistroColabHoy();
    if (existente) {
      mostrarToast("Ya tienes una entrada registrada hoy.", "error");
      await renderColabAsistencia();
      return;
    }
    const hora = await mostrarColabHoraModal("entrada");
    if (!hora) return;
    const preview = `<strong>Trabajador:</strong> ${sanitize(s.display)}<br><strong>Acción:</strong> Entrada<br><strong>Hora:</strong> ${hora}<br><strong>Fecha:</strong> ${getTodayStr()}`;
    const confirmado = await mostrarGuardar(
      "¿Confirmar registro de entrada?",
      preview,
    );
    if (!confirmado) return;
    const nuevo = {
      nombre: s.display,
      entrada: hora,
      salida: null,
      registrado_por: s.display,
      fecha: getTodayStr(),
      mes_asist_id: mesId,
    };
    const { error } = await supabaseClient.from("asistencia").insert(nuevo);
    if (error) {
      console.error(error);
      mostrarToast("Error al registrar entrada.", "error");
      return;
    }
    await audit(
      "add",
      `Entrada registrada por colaborador: ${s.display} (${hora}) — Mes: ${mesId}`,
    );
    mostrarToast(`✓ Entrada registrada a las ${hora}.`, "success");
    await renderColabAsistencia();
    await renderAsistencia();
  });

document
  .getElementById("btnColabSalida")
  .addEventListener("click", async () => {
    if (isAdmin()) return;
    const s = getSession();
    const registro = await getRegistroColabHoy();
    if (!registro) {
      mostrarToast("Primero debes registrar tu entrada.", "error");
      await renderColabAsistencia();
      return;
    }
    if (registro.salida) {
      mostrarToast("Tu salida ya fue registrada hoy.", "error");
      await renderColabAsistencia();
      return;
    }
    const hora = await mostrarColabHoraModal("salida");
    if (!hora) return;
    const [hE, mE] = registro.entrada.split(":").map(Number);
    const [hS, mS] = hora.split(":").map(Number);
    const minEntrada = hE * 60 + mE;
    const minSalida = hS * 60 + mS;
    // Permitir salida si han pasado al menos 1 minuto (considera turno nocturno)
    const diff =
      minSalida >= minEntrada
        ? minSalida - minEntrada
        : 1440 - minEntrada + minSalida;
    if (diff === 0) {
      mostrarToast("La salida no puede ser igual a la entrada.", "error");
      return;
    }
    const preview = `<strong>Trabajador:</strong> ${sanitize(s.display)}<br><strong>Acción:</strong> Salida<br><strong>Hora salida:</strong> ${hora}<br><strong>Duración:</strong> ${calcHoras(registro.entrada, hora)}`;
    const confirmado = await mostrarGuardar(
      "¿Confirmar registro de salida?",
      preview,
    );
    if (!confirmado) return;
    const { error } = await supabaseClient
      .from("asistencia")
      .update({ salida: hora })
      .eq("id", registro.id);
    if (error) {
      console.error(error);
      mostrarToast("Error al registrar salida.", "error");
      return;
    }
    await audit(
      "add",
      `Salida registrada por colaborador: ${s.display} (${hora})`,
    );
    mostrarToast(
      `✓ Salida registrada. Duración: ${calcHoras(registro.entrada, hora)}.`,
      "success",
    );
    await renderColabAsistencia();
    await renderAsistencia();
  });

async function renderAsistencia() {
  const lista = await getAsistencias();
  const tbody = document.getElementById("bodyAsistencia");
  const empty = document.getElementById("emptyAsistencia");
  document.getElementById("totalAsistencias").textContent =
    `${lista.length} registro${lista.length !== 1 ? "s" : ""} en este mes`;
  if (!lista.length) {
    tbody.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");
  tbody.innerHTML = lista
    .map(
      (r, i) => `
    <tr class="${i === lista.length - 1 ? "row-new" : ""}">
      <td>${i + 1}</td>
      <td>${sanitize(r.nombre)}</td>
      <td class="val-mono" style="font-size:0.78rem;color:var(--text-muted)">${r.fecha || ""}</td>
      <td class="val-mono">${r.entrada}</td>
      <td class="val-mono">${r.salida || '<span style="color:var(--text-muted)">—</span>'}</td>
      <td class="val-mono">${calcHoras(r.entrada, r.salida)}</td>
      <td><span class="reg-by">${sanitize(r.registrado_por || "—")}</span></td>
      <td>${isAdmin() ? `<button class="btn-delete" onclick="delAsistencia('${r.id}')">✕</button>` : ""}</td>
    </tr>`,
    )
    .join("");
}

async function delAsistencia(id) {
  if (!isAdmin()) return;
  const confirmado = await mostrarConfirm(
    "¿Eliminar registro?",
    "Se eliminará este registro de asistencia.",
    "Eliminar",
  );
  if (!confirmado) return;
  const lista = await getAsistencias();
  const reg = lista.find((r) => r.id === id);
  const { error } = await supabaseClient
    .from("asistencia")
    .delete()
    .eq("id", id);
  if (error) {
    console.error(error);
    mostrarToast("Error al eliminar el registro.", "error");
    return;
  }
  await audit("delete", `Asistencia eliminada: ${reg?.nombre || id}`);
  await renderAsistencia();
  mostrarToast("Registro eliminado.", "info");
}

document
  .querySelectorAll('input[name="accionAsistencia"]')
  .forEach((r) => r.addEventListener("change", toggleAsistenciaMode));

function toggleAsistenciaMode() {
  if (!isAdmin()) return;
  const isEntrada =
    document.querySelector('input[name="accionAsistencia"]:checked').value ===
    "entrada";
  document.getElementById("groupSelectSalida").style.display = isEntrada
    ? "none"
    : "block";
  document.getElementById("groupNombreTrabajador").style.display = isEntrada
    ? "block"
    : "none";
  document.getElementById("groupHoraEntrada").style.display = isEntrada
    ? "block"
    : "none";
  document.getElementById("groupHoraSalida").style.display = "block";
  const labelEntrada = document.getElementById("labelAccionEntrada");
  const labelSalida = document.getElementById("labelAccionSalida");
  if (labelEntrada) labelEntrada.style.opacity = isEntrada ? "1" : "0.7";
  if (labelSalida) labelSalida.style.opacity = isEntrada ? "0.7" : "1";
  if (!isEntrada) populateSelectSalida();
}

async function populateSelectSalida() {
  const select = document.getElementById("selectTrabajadorSalida");
  const lista = await getAsistenciasHoy();
  const filtered = lista.filter((r) => r.entrada && !r.salida);
  select.innerHTML =
    '<option value="">— Selecciona —</option>' +
    filtered
      .map((r) => `<option value="${r.id}">${sanitize(r.nombre)}</option>`)
      .join("");
}

document
  .getElementById("formAsistencia")
  .addEventListener("submit", async function (e) {
    e.preventDefault();
    if (!isAdmin()) {
      mostrarToast("Sin permisos para registrar asistencia.", "error");
      return;
    }
    const mesId = getMesActivoAsistencia();
    if (!mesId) {
      mostrarToast("Crea un mes de asistencia primero.", "error");
      return;
    }
    const accion = document.querySelector(
      'input[name="accionAsistencia"]:checked',
    ).value;

    if (accion === "entrada") {
      const nom = document.getElementById("nombreTrabajador");
      const ent = document.getElementById("horaEntrada");
      const sal = document.getElementById("horaSalida");
      clearErrors(["err-nombre", "err-entrada", "err-salida"], [nom, ent, sal]);
      let ok = true;
      if (!nom.value.trim() || nom.value.trim().length < 3) {
        setError("err-nombre", nom, "Mínimo 3 caracteres.");
        ok = false;
      }
      if (!ent.value) {
        setError("err-entrada", ent, "Ingresa la hora de entrada.");
        ok = false;
      }
      if (sal.value && sal.value === ent.value) {
        setError("err-salida", sal, "Salida no puede ser igual a entrada.");
        ok = false;
      }
      if (!ok) return;
      const s = getSession();
      const hoy = getTodayStr();
      const lista = await getAsistenciasHoy();
      const yaExiste = lista.find(
        (r) => r.nombre.toLowerCase() === nom.value.trim().toLowerCase(),
      );
      if (yaExiste) {
        mostrarToast(
          `Ya existe un registro para ${nom.value.trim()} hoy.`,
          "error",
        );
        return;
      }
      const preview = `<strong>Trabajador:</strong> ${sanitize(nom.value.trim())}<br><strong>Hora entrada:</strong> ${ent.value}${sal.value ? `<br><strong>Hora salida:</strong> ${sal.value}` : ""}<br><strong>Fecha:</strong> ${hoy}<br><strong>Registrado por:</strong> ${sanitize(s?.display || "—")}`;
      const confirmado = await mostrarGuardar(
        "¿Confirmar registro de entrada?",
        preview,
      );
      if (!confirmado) return;
      const nuevo = {
        nombre: nom.value.trim(),
        entrada: ent.value,
        salida: sal.value || null,
        registrado_por: s?.display || "—",
        fecha: hoy,
        mes_asist_id: mesId,
      };
      const { error } = await supabaseClient.from("asistencia").insert(nuevo);
      if (error) {
        console.error(error);
        mostrarToast("Error al guardar la asistencia.", "error");
        return;
      }
      await audit(
        "add",
        `Asistencia registrada (admin): ${nuevo.nombre} (${nuevo.entrada}–${nuevo.salida || "sin salida"})`,
      );
      await renderAsistencia();
      mostrarToast(`✓ Asistencia de ${nuevo.nombre} registrada.`, "success");
      this.reset();
      toggleAsistenciaMode();
    } else {
      const select = document.getElementById("selectTrabajadorSalida");
      const sal = document.getElementById("horaSalida");
      clearErrors(["err-select", "err-salida"], [select, sal]);
      let ok = true;
      if (!select.value) {
        setError("err-select", select, "Selecciona un trabajador.");
        ok = false;
      }
      if (!sal.value) {
        setError("err-salida", sal, "Ingresa la hora de salida.");
        ok = false;
      }
      if (!ok) return;
      const lista = await getAsistenciasHoy();
      const reg = lista.find((r) => r.id === select.value);
      if (!reg) {
        mostrarToast("Registro no encontrado.", "error");
        return;
      }
      if (reg.salida) {
        mostrarToast("Este trabajador ya tiene salida registrada.", "error");
        return;
      }
      if (sal.value === reg.entrada) {
        setError("err-salida", sal, "Salida no puede ser igual a entrada.");
        return;
      }
      const preview = `<strong>Trabajador:</strong> ${sanitize(reg.nombre)}<br><strong>Hora salida:</strong> ${sal.value}<br><strong>Duración:</strong> ${calcHoras(reg.entrada, sal.value)}`;
      const confirmado = await mostrarGuardar(
        "¿Confirmar registro de salida?",
        preview,
      );
      if (!confirmado) return;
      const { error } = await supabaseClient
        .from("asistencia")
        .update({ salida: sal.value })
        .eq("id", select.value);
      if (error) {
        console.error(error);
        mostrarToast("Error al registrar la salida.", "error");
        return;
      }
      await audit(
        "add",
        `Salida registrada (admin): ${reg.nombre} (${sal.value})`,
      );
      await renderAsistencia();
      mostrarToast(`✓ Salida de ${reg.nombre} registrada.`, "success");
      this.reset();
      toggleAsistenciaMode();
    }
  });

document
  .getElementById("clearAsistencia")
  .addEventListener("click", async () => {
    if (!isAdmin()) return;
    const mesId = getMesActivoAsistencia();
    const meses = await getMesesAsistencia();
    const mes = meses.find((m) => m.id === mesId);
    const confirmado = await mostrarConfirm(
      `¿Limpiar registros del mes "${mes?.nombre || "actual"}"?`,
      "Se eliminarán TODOS los registros de asistencia de este mes.",
      "Limpiar todo",
    );
    if (!confirmado) return;
    let query = supabaseClient.from("asistencia").delete();
    if (mesId) query = query.eq("mes_asist_id", mesId);
    else query = query.eq("fecha", getTodayStr());
    const { error } = await query;
    if (error) {
      console.error(error);
      mostrarToast("Error al limpiar asistencias.", "error");
      return;
    }
    await audit(
      "clear",
      `Registros de asistencia del mes "${mes?.nombre}" eliminados`,
    );
    await renderAsistencia();
    mostrarToast("Registros del mes eliminados.", "info");
  });

/* ══════════════════════════════════════════════
   8. VENTAS POR MES
   ══════════════════════════════════════════════ */
async function getMeses() {
  const { data, error } = await supabaseClient
    .from("meses")
    .select("*")
    .order("nombre", { ascending: true });
  if (error) {
    console.error(error);
    return [];
  }
  return data || [];
}

async function getDias(mesId) {
  const { data, error } = await supabaseClient
    .from("dias")
    .select("*")
    .eq("mes_id", mesId)
    .order("fecha", { ascending: true });
  if (error) {
    console.error(error);
    return [];
  }
  return data || [];
}

function getMesActivo() {
  return document.getElementById("mesSelector").value;
}

async function renderSelectMeses() {
  const sel = document.getElementById("mesSelector");
  const prev = sel.value;
  const meses = await getMeses();
  sel.innerHTML = meses.length
    ? meses
        .map((m) => `<option value="${m.id}">${sanitize(m.nombre)}</option>`)
        .join("")
    : '<option value="">— Sin meses creados —</option>';
  if (prev && meses.find((m) => m.id === prev)) sel.value = prev;
  else if (meses.length) sel.value = meses[meses.length - 1].id;
}

async function renderVentas() {
  const mesId = getMesActivo();
  const meses = await getMeses();
  const mes = meses.find((m) => m.id === mesId);
  if (isAdmin()) {
    document.getElementById("labelMesActual").textContent = mes
      ? `DÍAS REGISTRADOS — ${mes.nombre.toUpperCase()}`
      : "DÍAS REGISTRADOS";
  }
  const lista = mesId ? await getDias(mesId) : [];
  if (isAdmin()) {
    const tbody = document.getElementById("bodyVentas");
    const empty = document.getElementById("emptyVentas");
    if (!lista.length) {
      tbody.innerHTML = "";
      empty.classList.remove("hidden");
      actualizarReporte([]);
      return;
    }
    empty.classList.add("hidden");
    tbody.innerHTML = lista
      .map((d, i) => {
        const totalBruto = (d.efectivo || 0) + (d.yape || 0) + (d.plin || 0);
        const gastos = d.transf || 0;
        const totalNeto = totalBruto - gastos;
        const ganancia = d.ganancia || 0;
        const balance = totalNeto - ganancia;
        const clsGan = ganancia >= 0 ? "val-ganancia" : "val-negativo";
        const pctGan = fmtPct(ganancia, totalNeto);
        const fechaFmt = new Date(d.fecha + "T12:00:00").toLocaleDateString(
          "es-PE",
          { weekday: "short", day: "2-digit", month: "short", year: "numeric" },
        );
        return `
        <tr class="${i === lista.length - 1 ? "row-new" : ""}">
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
          <td><span class="reg-by">${sanitize(d.registrado_por || "—")}</span></td>
          <td><button class="btn-delete" onclick="delDia('${mesId}','${d.id}')">✕</button></td>
        </tr>`;
      })
      .join("");
    actualizarReporte(lista);
  }
}

function actualizarReporte(lista) {
  if (!isAdmin()) return;
  const totalE = lista.reduce((a, d) => a + (d.efectivo || 0), 0);
  const totalY = lista.reduce((a, d) => a + (d.yape || 0), 0);
  const totalP = lista.reduce((a, d) => a + (d.plin || 0), 0);
  const totalT = lista.reduce((a, d) => a + (d.transf || 0), 0);
  const totalBruto = totalE + totalY + totalP;
  const totalNeto = totalBruto - totalT;
  const totalG = lista.reduce((a, d) => a + (d.ganancia || 0), 0);
  const totalB = totalNeto - totalG;
  document.getElementById("reporteEfectivo").textContent = fmt(totalE);
  document.getElementById("reporteYape").textContent = fmt(totalY);
  document.getElementById("reportePlin").textContent = fmt(totalP);
  document.getElementById("reporteTransf").textContent = fmt(totalT);
  document.getElementById("reporteTotalBruto").textContent = fmt(totalBruto);
  document.getElementById("reporteTotalVentas").textContent = fmt(totalNeto);
  document.getElementById("reporteCostoTotal").textContent = fmt(totalG);
  document.getElementById("reporteGananciaTotal").textContent = fmt(totalB);
  document.getElementById("reporteDias").textContent = lista.length;
  document.getElementById("reporteGananciaTotal").style.color =
    totalB >= 0 ? "var(--success)" : "var(--danger)";
}

async function delDia(mesId, id) {
  if (!isAdmin()) return;
  const confirmado = await mostrarConfirm(
    "¿Eliminar este día?",
    "Se eliminará permanentemente el registro de este día.",
    "Eliminar",
  );
  if (!confirmado) return;
  const lista = await getDias(mesId);
  const reg = lista.find((d) => d.id === id);
  const { error } = await supabaseClient.from("dias").delete().eq("id", id);
  if (error) {
    console.error(error);
    mostrarToast("Error al eliminar el día.", "error");
    return;
  }
  const totalBruto = (reg?.efectivo || 0) + (reg?.yape || 0) + (reg?.plin || 0);
  const gastos = reg?.transf || 0;
  await audit(
    "delete",
    `Día eliminado: ${reg?.fecha} — Total neto: ${fmt(totalBruto - gastos)}`,
  );
  await renderVentas();
  await renderSelectMesesDescargas();
  mostrarToast("Día eliminado.", "info");
}

function actualizarPreview() {
  const e = parseFloat(document.getElementById("ventaEfectivo").value) || 0;
  const y = parseFloat(document.getElementById("ventaYape").value) || 0;
  const p = parseFloat(document.getElementById("ventaPlin").value) || 0;
  const t = parseFloat(document.getElementById("ventaTransf").value) || 0;
  const g = parseFloat(document.getElementById("gananciaDelDia").value) || 0;
  const totalBruto = e + y + p;
  const totalNeto = totalBruto - t;
  const balance = totalNeto - g;
  document.getElementById("previewEfectivo").textContent = fmt(e);
  document.getElementById("previewYapeVal").textContent = fmt(y);
  document.getElementById("previewPlinVal").textContent = fmt(p);
  document.getElementById("previewTransfVal").textContent = fmt(t);
  document.getElementById("previewTotalBruto").textContent = fmt(totalBruto);
  document.getElementById("previewTotal").textContent = fmt(totalNeto);
  document.getElementById("previewGanancia").textContent = fmt(g);
  document.getElementById("previewBalance").textContent = fmt(balance);
  document.getElementById("previewGanancia").style.color =
    g >= 0 ? "var(--accent-light)" : "var(--danger)";
}

[
  "ventaEfectivo",
  "ventaYape",
  "ventaPlin",
  "ventaTransf",
  "gananciaDelDia",
].forEach((id) =>
  document.getElementById(id).addEventListener("input", actualizarPreview),
);

document
  .getElementById("formVentas")
  .addEventListener("submit", async function (e) {
    e.preventDefault();
    const fec = document.getElementById("fechaVenta");
    const efectivo = document.getElementById("ventaEfectivo");
    const yape = document.getElementById("ventaYape");
    const plin = document.getElementById("ventaPlin");
    const transf = document.getElementById("ventaTransf");
    const ganancia = document.getElementById("gananciaDelDia");
    clearErrors(
      [
        "err-fecha",
        "err-efectivo",
        "err-yape",
        "err-plin",
        "err-transf",
        "err-ganancia",
      ],
      [fec, efectivo, yape, plin, transf, ganancia],
    );
    const mesId = getMesActivo();
    if (!mesId) {
      mostrarToast("Crea un mes primero.", "error");
      return;
    }
    let ok = true;
    if (!fec.value) {
      setError("err-fecha", fec, "Selecciona una fecha.");
      ok = false;
    }
    const eNum = parseFloat(efectivo.value) || 0;
    const yNum = parseFloat(yape.value) || 0;
    const pNum = parseFloat(plin.value) || 0;
    const tNum = parseFloat(transf.value) || 0;
    const gNum = parseFloat(ganancia.value) || 0;
    if (eNum === 0 && yNum === 0 && pNum === 0) {
      setError("err-efectivo", efectivo, "Ingresa al menos un monto de venta.");
      ok = false;
    }
    if (gNum < 0) {
      setError("err-ganancia", ganancia, "La ganancia no puede ser negativa.");
      ok = false;
    }
    if (!ok) return;
    const tb = eNum + yNum + pNum;
    const tn = tb - tNum;
    const meses = await getMeses();
    const mesActual = meses.find((m) => m.id === mesId);
    if (!mesActual) {
      mostrarToast(
        "El mes seleccionado no existe. Recarga la página.",
        "error",
      );
      return;
    }
    const lista = await getDias(mesId);
    const existe = lista.find((d) => d.fecha === fec.value);
    const s = getSession();
    if (existe) {
      if (!isAdmin()) {
        mostrarToast(
          "Ya existe un registro para esa fecha. Solo el administrador puede modificarlo.",
          "error",
        );
        return;
      }
      const confirmado = await mostrarConfirm(
        `¿Sobreescribir ${fec.value}?`,
        `Ya existe un registro para esta fecha. ¿Deseas reemplazarlo?`,
        "Sobreescribir",
      );
      if (!confirmado) return;
      const { error } = await supabaseClient
        .from("dias")
        .update({
          efectivo: eNum,
          yape: yNum,
          plin: pNum,
          transf: tNum,
          ganancia: gNum,
          registrado_por: s?.display || "—",
        })
        .eq("id", existe.id);
      if (error) {
        console.error(error);
        mostrarToast("Error al actualizar el día.", "error");
        return;
      }
      await audit(
        "add",
        `Día sobreescrito: ${fec.value} [Mes: ${mesActual.nombre}]`,
      );
    } else {
      const preview = `<strong>Mes:</strong> ${sanitize(mesActual.nombre)}<br><strong>Fecha:</strong> ${fec.value}<br><strong>Efectivo:</strong> ${fmt(eNum)} &nbsp; <strong>Yape:</strong> ${fmt(yNum)} &nbsp; <strong>Plin:</strong> ${fmt(pNum)}<br><strong>Gastos:</strong> ${fmt(tNum)}<br><strong>Total bruto:</strong> ${fmt(tb)} &nbsp; <strong>Total neto:</strong> ${fmt(tn)}<br><strong>Ganancia:</strong> ${fmt(gNum)}<br><strong>Registrado por:</strong> ${sanitize(s?.display || "—")}`;
      const confirmado = await mostrarGuardar(
        "¿Confirmar registro del día?",
        preview,
      );
      if (!confirmado) return;
      const nuevoDia = {
        mes_id: mesId,
        fecha: fec.value,
        efectivo: eNum,
        yape: yNum,
        plin: pNum,
        transf: tNum,
        ganancia: gNum,
        registrado_por: s?.display || "—",
      };
      const { error } = await supabaseClient.from("dias").insert(nuevoDia);
      if (error) {
        console.error(error);
        mostrarToast("Error al guardar el día.", "error");
        return;
      }
      await audit(
        "add",
        `Día registrado: ${fec.value} [Mes: ${mesActual.nombre}]`,
      );
      if (!isAdmin())
        document
          .getElementById("cardColabVentasMsg")
          .classList.remove("hidden");
    }
    await renderVentas();
    if (isAdmin()) await renderSelectMesesDescargas();
    mostrarToast("✓ Día guardado correctamente.", "success");
    this.reset();
    actualizarPreview();
    const hoy = new Date();
    document.getElementById("fechaVenta").value =
      `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
  });

document.getElementById("clearDia").addEventListener("click", async () => {
  if (!isAdmin()) return;
  const mesId = getMesActivo();
  if (!mesId) {
    mostrarToast("No hay mes seleccionado.", "error");
    return;
  }
  const meses = await getMeses();
  const mes = meses.find((m) => m.id === mesId);
  const confirmado = await mostrarConfirm(
    `¿Limpiar el mes "${mes?.nombre}"?`,
    "Se eliminarán todos los días registrados de este mes.",
    "Limpiar mes",
  );
  if (!confirmado) return;
  const { error } = await supabaseClient
    .from("dias")
    .delete()
    .eq("mes_id", mesId);
  if (error) {
    console.error(error);
    mostrarToast("Error al limpiar el mes.", "error");
    return;
  }
  await audit("clear", `Mes limpiado: ${mes?.nombre}`);
  await renderVentas();
  await renderSelectMesesDescargas();
  mostrarToast("Mes limpiado.", "info");
});

document.getElementById("mesSelector").addEventListener("change", async () => {
  await renderVentas();
  if (isAdmin()) await renderSelectMesesDescargas();
});

document
  .getElementById("clearAuditoria")
  .addEventListener("click", async () => {
    if (!isAdmin()) return;
    const confirmado = await mostrarConfirm(
      "¿Eliminar historial de auditoría?",
      "Se borrará todo el registro de acciones. Esta operación es irreversible.",
      "Eliminar historial",
    );
    if (!confirmado) return;
    await audit("clear", "Historial de auditoría limpiado");
    const { error } = await supabaseClient
      .from("auditoria")
      .delete()
      .neq("id", "dummy");
    if (error) {
      console.error(error);
      mostrarToast("Error al limpiar auditoría.", "error");
      return;
    }
    await renderAuditoria();
    mostrarToast("Historial limpiado.", "info");
  });

/* ══════════════════════════════════════════════
   9. MODAL — NUEVO MES (VENTAS)
   ══════════════════════════════════════════════ */
const overlay = document.getElementById("modalOverlay");
const inputMes = document.getElementById("inputNuevoMes");

document.getElementById("btnNuevoMes").addEventListener("click", () => {
  inputMes.value = "";
  document.getElementById("err-mes").textContent = "";
  inputMes.classList.remove("input-error");
  overlay.classList.add("active");
  setTimeout(() => inputMes.focus(), 80);
});
document
  .getElementById("modalCancelar")
  .addEventListener("click", () => overlay.classList.remove("active"));
document
  .getElementById("modalCerrar")
  .addEventListener("click", () => overlay.classList.remove("active"));
overlay.addEventListener("click", (e) => {
  if (e.target === overlay) overlay.classList.remove("active");
});

document
  .getElementById("modalConfirmar")
  .addEventListener("click", async () => {
    const nombre = inputMes.value.trim();
    const errEl = document.getElementById("err-mes");
    inputMes.classList.remove("input-error");
    errEl.textContent = "";
    if (!nombre || nombre.length < 2) {
      errEl.textContent = "Mínimo 2 caracteres.";
      inputMes.classList.add("input-error");
      return;
    }
    const meses = await getMeses();
    if (meses.find((m) => m.nombre.toLowerCase() === nombre.toLowerCase())) {
      errEl.textContent = "Ya existe un mes con ese nombre.";
      inputMes.classList.add("input-error");
      return;
    }
    const nuevoMes = { id: uid(), nombre };
    const { error } = await supabaseClient.from("meses").insert(nuevoMes);
    if (error) {
      console.error(error);
      mostrarToast("Error al crear el mes.", "error");
      return;
    }
    await renderSelectMeses();
    if (isAdmin()) await renderSelectMesesDescargas();
    document.getElementById("mesSelector").value = nuevoMes.id;
    await renderVentas();
    await audit("add", `Nuevo mes creado: ${nombre}`);
    overlay.classList.remove("active");
    mostrarToast(`✓ Mes "${nombre}" creado correctamente.`, "success");
  });

inputMes.addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("modalConfirmar").click();
  if (e.key === "Escape") overlay.classList.remove("active");
});

/* ══════════════════════════════════════════════
   10. PERMISOS
   ══════════════════════════════════════════════ */
function updateFieldPermissions() {
  document.querySelectorAll(".btn-delete").forEach((btn) => {
    btn.style.display = isAdmin() ? "inline-flex" : "none";
  });
}

/* ══════════════════════════════════════════════
   11. DESCARGAS — Excel con SheetJS
   ══════════════════════════════════════════════ */
function exportarExcel(filename, sheetName, headers, rows) {
  if (typeof XLSX === "undefined") {
    mostrarToast("Error: librería Excel no cargada.", "error");
    return;
  }
  const wsData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const colWidths = headers.map((h, i) => {
    const maxLen = Math.max(
      String(h).length,
      ...rows.map((r) => String(r[i] ?? "").length),
    );
    return { wch: Math.min(maxLen + 4, 40) };
  });
  ws["!cols"] = colWidths;
  const range = XLSX.utils.decode_range(ws["!ref"]);
  for (let C = range.s.c; C <= range.e.c; C++) {
    const cellAddr = XLSX.utils.encode_cell({ r: 0, c: C });
    if (!ws[cellAddr]) continue;
    ws[cellAddr].s = { font: { bold: true } };
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, filename + ".xlsx");
}

async function renderSelectMesesDescargas() {
  if (!isAdmin()) return;
  const sel = document.getElementById("selectMesVentasDescargas");
  const meses = await getMeses();
  sel.innerHTML = meses.length
    ? meses
        .map((m) => `<option value="${m.id}">${sanitize(m.nombre)}</option>`)
        .join("")
    : '<option value="">— Sin meses creados —</option>';
  if (meses.length > 0) sel.value = meses[meses.length - 1].id;
}

async function renderSelectMesesDescargasAsistencia() {
  if (!isAdmin()) return;
  const sel = document.getElementById("selectMesAsistDescargas");
  if (!sel) return;
  const meses = await getMesesAsistencia();
  sel.innerHTML = meses.length
    ? meses
        .map((m) => `<option value="${m.id}">${sanitize(m.nombre)}</option>`)
        .join("")
    : '<option value="">— Sin meses creados —</option>';
  if (meses.length > 0) sel.value = meses[meses.length - 1].id;
}

document
  .getElementById("btnDescargarVentas")
  .addEventListener("click", async () => {
    if (!isAdmin()) {
      mostrarToast("Solo el administrador puede exportar datos.", "error");
      return;
    }
    const autenticado = await mostrarReauth();
    if (!autenticado) return;
    const mesId = document.getElementById("selectMesVentasDescargas").value;
    if (!mesId) {
      mostrarToast("Selecciona un mes para descargar.", "error");
      return;
    }
    const meses = await getMeses();
    const mes = meses.find((m) => m.id === mesId);
    const dias = await getDias(mesId);
    if (!dias.length) {
      mostrarToast("No hay datos en este mes.", "info");
      return;
    }
    const headers = [
      "Fecha",
      "Día",
      "Efectivo (S/)",
      "Yape (S/)",
      "Plin (S/)",
      "Gastos (S/)",
      "Total Bruto (S/)",
      "Total Neto (S/)",
      "Ganancia Realizada (S/)",
      "Balance Restante (S/)",
      "Margen %",
      "Registrado por",
    ];
    const rows = [];
    const sorted = [...dias].sort((a, b) => a.fecha.localeCompare(b.fecha));
    sorted.forEach((d) => {
      const bruto = (d.efectivo || 0) + (d.yape || 0) + (d.plin || 0);
      const neto = bruto - (d.transf || 0);
      const gan = d.ganancia || 0;
      const balance = neto - gan;
      const margen = neto > 0 ? ((gan / neto) * 100).toFixed(1) + "%" : "0%";
      const dia = new Date(d.fecha + "T12:00:00")
        .toLocaleDateString("es-PE", { weekday: "short" })
        .toUpperCase();
      rows.push([
        d.fecha,
        dia,
        +(d.efectivo || 0).toFixed(2),
        +(d.yape || 0).toFixed(2),
        +(d.plin || 0).toFixed(2),
        +(d.transf || 0).toFixed(2),
        +bruto.toFixed(2),
        +neto.toFixed(2),
        +gan.toFixed(2),
        +balance.toFixed(2),
        margen,
        d.registrado_por || "—",
      ]);
    });
    const totalE = dias.reduce((a, d) => a + (d.efectivo || 0), 0);
    const totalY = dias.reduce((a, d) => a + (d.yape || 0), 0);
    const totalP = dias.reduce((a, d) => a + (d.plin || 0), 0);
    const totalT = dias.reduce((a, d) => a + (d.transf || 0), 0);
    const totalB = totalE + totalY + totalP;
    const totalN = totalB - totalT;
    const totalG = dias.reduce((a, d) => a + (d.ganancia || 0), 0);
    const totalBal = totalN - totalG;
    rows.push([]);
    rows.push([
      "TOTAL",
      "",
      +totalE.toFixed(2),
      +totalY.toFixed(2),
      +totalP.toFixed(2),
      +totalT.toFixed(2),
      +totalB.toFixed(2),
      +totalN.toFixed(2),
      +totalG.toFixed(2),
      +totalBal.toFixed(2),
      totalN > 0 ? ((totalG / totalN) * 100).toFixed(1) + "%" : "0%",
      "",
    ]);
    const hoy = new Date();
    exportarExcel(
      `Ventas_${mes.nombre}_${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`,
      mes.nombre,
      headers,
      rows,
    );
    await audit("add", `Exportación Excel de ventas: ${mes.nombre}`);
    mostrarToast("✓ Reporte de ventas descargado.", "success");
  });

document
  .getElementById("btnDescargarAsistencias")
  .addEventListener("click", async () => {
    if (!isAdmin()) {
      mostrarToast("Solo el administrador puede exportar datos.", "error");
      return;
    }
    const autenticado = await mostrarReauth();
    if (!autenticado) return;
    const mesId = document.getElementById("selectMesAsistDescargas")?.value;
    if (!mesId) {
      mostrarToast("Selecciona un mes de asistencia para descargar.", "error");
      return;
    }
    const meses = await getMesesAsistencia();
    const mes = meses.find((m) => m.id === mesId);
    const { data: asistencias, error } = await supabaseClient
      .from("asistencia")
      .select("*")
      .eq("mes_asist_id", mesId)
      .order("fecha", { ascending: true })
      .order("entrada", { ascending: true });
    if (error || !asistencias?.length) {
      mostrarToast("No hay asistencias para este mes.", "info");
      return;
    }
    const headers = [
      "#",
      "Trabajador",
      "Fecha",
      "Día",
      "Hora Entrada",
      "Hora Salida",
      "Duración",
      "Registrado por",
    ];
    const rows = asistencias.map((r, i) => {
      const fecha = r.fecha ? new Date(r.fecha + "T12:00:00") : null;
      const dia = fecha
        ? fecha.toLocaleDateString("es-PE", { weekday: "short" }).toUpperCase()
        : "—";
      return [
        i + 1,
        r.nombre,
        r.fecha || "—",
        dia,
        r.entrada,
        r.salida || "—",
        calcHoras(r.entrada, r.salida),
        r.registrado_por || "—",
      ];
    });
    rows.push([]);
    rows.push(["--- RESUMEN POR TRABAJADOR ---", "", "", "", "", "", "", ""]);
    rows.push([
      "Trabajador",
      "Días registrados",
      "Días completos",
      "Total horas aprox.",
      "",
      "",
      "",
      "",
    ]);
    const trabajadoresMap = {};
    asistencias.forEach((r) => {
      if (!trabajadoresMap[r.nombre])
        trabajadoresMap[r.nombre] = { dias: 0, completos: 0, minutos: 0 };
      trabajadoresMap[r.nombre].dias++;
      if (r.entrada && r.salida) {
        trabajadoresMap[r.nombre].completos++;
        const [hE, mE] = r.entrada.split(":").map(Number);
        const [hS, mS] = r.salida.split(":").map(Number);
        let min = hS * 60 + mS - (hE * 60 + mE);
        if (min < 0) min += 1440;
        trabajadoresMap[r.nombre].minutos += min;
      }
    });
    Object.entries(trabajadoresMap).forEach(([nombre, stats]) => {
      const horas = `${Math.floor(stats.minutos / 60)}h ${String(stats.minutos % 60).padStart(2, "0")}m`;
      rows.push([nombre, stats.dias, stats.completos, horas, "", "", "", ""]);
    });
    const hoy = new Date();
    exportarExcel(
      `Asistencias_${mes?.nombre || "mes"}_${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`,
      mes?.nombre || "Asistencias",
      headers,
      rows,
    );
    await audit(
      "add",
      `Exportación Excel de asistencias mensuales: ${mes?.nombre}`,
    );
    mostrarToast("✓ Asistencias del mes descargadas.", "success");
  });

/* ══════════════════════════════════════════════
   12. OBSERVACIONES DE MERCADERÍA + WHATSAPP
   ══════════════════════════════════════════════ */

/**
 * Envía un mensaje al WhatsApp del admin via CallMeBot API.
 * URL cors-bypass: usamos fetch directamente (funciona con CallMeBot desde el navegador).
 */
async function enviarWhatsApp(mensaje) {
  try {
    const texto = encodeURIComponent(mensaje);
    const url = `https://api.callmebot.com/whatsapp.php?phone=${WA_PHONE}&text=${texto}&apikey=${WA_APIKEY}`;
    const resp = await fetch(url, { method: "GET", mode: "no-cors" });
    // no-cors no da acceso al body, pero el envío sí se ejecuta en CallMeBot
    return true;
  } catch (err) {
    console.warn("WhatsApp send error (non-critical):", err);
    return false; // No bloquear si falla
  }
}

/* Contador de observaciones no leídas — badge en pestaña */
async function actualizarBadgeObs() {
  if (!isAdmin()) return;
  const { count, error } = await supabaseClient
    .from("observaciones_mercaderia")
    .select("id", { count: "exact", head: true })
    .eq("leida_admin", false);
  const badge = document.getElementById("obsBadge");
  if (!badge) return;
  if (!error && count > 0) {
    badge.textContent = count > 99 ? "99+" : count;
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }
}

/* Render de la tabla de observaciones */
async function renderObservaciones() {
  const s = getSession();
  const tbody = document.getElementById("bodyObservaciones");
  const empty = document.getElementById("emptyObservaciones");
  const meta = document.getElementById("totalObservaciones");

  let query = supabaseClient
    .from("observaciones_mercaderia")
    .select("*")
    .order("fecha", { ascending: false })
    .limit(200);

  // Colaboradores solo ven las suyas
  if (!isAdmin()) {
    query = query.eq("usuario", s.username);
  }

  const { data, error } = await query;
  if (error) {
    console.error(error);
    mostrarToast("Error al cargar observaciones.", "error");
    return;
  }

  const lista = data || [];
  meta.textContent = `${lista.length} observación${lista.length !== 1 ? "es" : ""}`;

  if (!lista.length) {
    tbody.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  tbody.innerHTML = lista
    .map((obs, i) => {
      const fecha = new Date(obs.fecha).toLocaleString("es-PE");
      const leida = obs.leida_admin;
      const badge = leida
        ? `<span class="obs-status-badge obs-status-badge--leida">✓ Leída</span>`
        : `<span class="obs-status-badge obs-status-badge--nueva">● Nueva</span>`;
      const accionAdmin =
        isAdmin() && !leida
          ? `<button class="btn-mark-leida" onclick="marcarObsLeida('${obs.id}')">Marcar leída</button>`
          : "";
      const eliminarBtn = isAdmin()
        ? `<button class="btn-delete" title="Eliminar observación" onclick="eliminarObservacion('${obs.id}')">✕</button>`
        : "";
      return `
      <tr class="${!leida ? "obs-row--nueva row-new" : ""}">
        <td>${i + 1}</td>
        <td class="val-mono" style="font-size:0.75rem;white-space:nowrap">${sanitize(fecha)}</td>
        ${isAdmin() ? `<td><span class="reg-by">${sanitize(obs.usuario)}</span></td>` : ""}
        <td class="obs-msg-text">${sanitize(obs.mensaje)}</td>
        <td>${badge}</td>
        ${isAdmin() ? `<td style="display:flex;gap:6px;align-items:center">${accionAdmin}${eliminarBtn}</td>` : ""}
      </tr>`;
    })
    .join("");

  if (isAdmin()) await actualizarBadgeObs();
}

/* Eliminar observación (solo admin) */
function mostrarEliminarObsModal() {
  return new Promise((resolve) => {
    const overlay = document.getElementById("modalEliminarObsOverlay");
    overlay.classList.add("active");
    const onAceptar = () => { overlay.classList.remove("active"); cleanup(); resolve(true); };
    const onCancelar = () => { overlay.classList.remove("active"); cleanup(); resolve(false); };
    const cleanup = () => {
      document.getElementById("elimObsAceptar").removeEventListener("click", onAceptar);
      document.getElementById("elimObsCancelar").removeEventListener("click", onCancelar);
    };
    document.getElementById("elimObsAceptar").addEventListener("click", onAceptar);
    document.getElementById("elimObsCancelar").addEventListener("click", onCancelar);
  });
}

async function eliminarObservacion(id) {
  if (!isAdmin()) return;
  const confirmado = await mostrarEliminarObsModal();
  if (!confirmado) return;
  const { error } = await supabaseClient
    .from("observaciones_mercaderia")
    .delete()
    .eq("id", id);
  if (error) {
    console.error(error);
    mostrarToast("Error al eliminar la observación.", "error");
    return;
  }
  await audit("delete", `Observación eliminada: ID ${id}`);
  await renderObservaciones();
  mostrarToast("Observación eliminada.", "info");
}

/* Marcar observación como leída (solo admin) */
async function marcarObsLeida(id) {
  if (!isAdmin()) return;
  const { error } = await supabaseClient
    .from("observaciones_mercaderia")
    .update({ leida_admin: true })
    .eq("id", id);
  if (error) {
    console.error(error);
    mostrarToast("Error al marcar como leída.", "error");
    return;
  }
  await renderObservaciones();
  mostrarToast("Observación marcada como leída.", "success");
}

/* Botón "Marcar todas como leídas" */
document
  .getElementById("btnMarcarTodasLeidas")
  .addEventListener("click", async () => {
    if (!isAdmin()) return;
    const confirmado = await mostrarConfirm(
      "¿Marcar todas como leídas?",
      "Se marcarán todas las observaciones pendientes como leídas.",
      "Confirmar",
    );
    if (!confirmado) return;
    const { error } = await supabaseClient
      .from("observaciones_mercaderia")
      .update({ leida_admin: true })
      .eq("leida_admin", false);
    if (error) {
      console.error(error);
      mostrarToast("Error al actualizar.", "error");
      return;
    }
    await renderObservaciones();
    mostrarToast("✓ Todas las observaciones marcadas como leídas.", "success");
  });

/* Contador de caracteres en textarea */
document.getElementById("obsTexto").addEventListener("input", function () {
  const len = this.value.length;
  const count = document.getElementById("obsCharCount");
  count.textContent = `${len} / 1000`;
  count.className =
    "obs-count" +
    (len > 900 ? " obs-count--limit" : len > 700 ? " obs-count--warn" : "");
});

/* Enviar observación */
document
  .getElementById("formObservacion")
  .addEventListener("submit", async function (e) {
    e.preventDefault();
    const s = getSession();
    const textarea = document.getElementById("obsTexto");
    const errEl = document.getElementById("err-obs");
    const btn = document.getElementById("btnEnviarObs");

    errEl.textContent = "";
    textarea.classList.remove("input-error");

    const texto = textarea.value.trim();

    if (!texto || texto.length < 5) {
      errEl.textContent = "El mensaje debe tener al menos 5 caracteres.";
      textarea.classList.add("input-error");
      return;
    }
    if (texto.length > 1000) {
      errEl.textContent = "El mensaje no puede superar los 1000 caracteres.";
      textarea.classList.add("input-error");
      return;
    }

    /* Deshabilitar botón y mostrar spinner */
    btn.disabled = true;
    btn.innerHTML = `<span class="obs-sending-spinner"></span> Enviando...`;

    try {
      /* 1. Guardar en Supabase */
      const ahora = new Date().toISOString();
      const obs = {
        fecha: ahora,
        fecha_registro: ahora,
        usuario: s.username,
        username: s.username,
        colaborador: s.display,
        user_email: s.email,
        rol: s.role,
        asunto: "Observación de mercadería",
        detalle: texto,
        mensaje: texto,
        leida_admin: false,
        notificado_whatsapp: false,
        notificado_en: null,
        ip_origen: null,
        mes_asist_id: null,
      };
      const { error } = await supabaseClient
        .from("observaciones_mercaderia")
        .insert(obs);
      if (error) {
        console.error(
          "Supabase error detalle:",
          error.code,
          error.message,
          error.details,
          error.hint,
        );
        throw error;
      }

      /* 2. Enviar WhatsApp al admin */
      const fechaLegible = new Date().toLocaleString("es-PE");
      const waMsg = `📦 *KRD Importaciones - Nueva Observación*\n\n👤 Colaborador: ${s.display}\n📅 Fecha: ${fechaLegible}\n\n💬 Mensaje:\n${texto}`;
      await enviarWhatsApp(waMsg);

      /* 3. Auditoría */
      await audit("add", `Observación enviada por: ${s.display}`);

      /* 4. Mostrar confirmación */
      textarea.value = "";
      document.getElementById("obsCharCount").textContent = "0 / 1000";
      document.getElementById("obsCharCount").className = "obs-count";

      await mostrarObsConfirm(texto, s.display);
      await renderObservaciones();
    } catch (err) {
      console.error("Error al enviar observación:", err);
      mostrarToast(
        "Error al enviar la observación. Intenta de nuevo.",
        "error",
      );
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Enviar Observación`;
    }
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
  document.getElementById("fechaVenta").value =
    `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
})();