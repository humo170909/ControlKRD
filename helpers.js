// helpers.js — Utilidades generales KRD Importaciones

/* ── Fecha y hora ── */
function getTodayStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getNowTimeStr() {
  const n = new Date();
  return `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
}

/* ── Sanitización XSS ──
   Convierte caracteres especiales HTML en entidades seguras.
   Siempre usar antes de insertar texto de usuario en innerHTML. */
function sanitize(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g,  "&amp;")
    .replace(/</g,  "&lt;")
    .replace(/>/g,  "&gt;")
    .replace(/"/g,  "&quot;")
    .replace(/'/g,  "&#x27;")
    .replace(/\//g, "&#x2F;");
}

/* ── Toast de notificación ── */
function mostrarToast(msg, tipo = "success") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = `toast show toast-${tipo}`;
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove("show"), 3500);
}

/* ── Formato moneda Soles ── */
function fmt(n) {
  return (
    "S/ " +
    Number(n)
      .toFixed(2)
      .replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  );
}

/* ── Formato porcentaje ── */
function fmtPct(v, t) {
  if (!t || t === 0) return "0%";
  return ((v / t) * 100).toFixed(1) + "%";
}

/* ── ID único (crypto-safe) ── */
function uid() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

/* ── Cálculo de horas trabajadas ── */
function calcHoras(e, s) {
  if (!e || !s) return "—";
  const [hE, mE] = e.split(":").map(Number);
  const [hS, mS] = s.split(":").map(Number);
  let min = hS * 60 + mS - (hE * 60 + mE);
  if (min < 0) min += 1440; // turno nocturno
  return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, "0")}m`;
}

/* ── Manejo de errores en formularios ── */
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

/* ── Estado de asistencia según hora de entrada ──
   Límite: 10:20 AM. Antes o igual → "Asistencia", después → "Tardanza" */
function getEstadoAsistencia(horaEntrada) {
  if (!horaEntrada) return "";
  const [hh, mm] = horaEntrada.split(":").map(Number);
  const totalMin  = hh * 60 + mm;
  const limiteMin = 10 * 60 + 20; // 10:20 AM
  return totalMin <= limiteMin ? "Asistencia" : "Tardanza";
}

/* ── Permisos visuales según rol ── */
function updateFieldPermissions() {
  document.querySelectorAll(".btn-delete").forEach((btn) => {
    btn.style.display = isAdmin() ? "inline-flex" : "none";
  });
}

// Obtiene la IP pública del usuario
async function getClientIP() {
  try {
    const res = await fetch("https://api.ipify.org?format=json");
    const data = await res.json();
    return data.ip || "desconocida";
  } catch {
    return "desconocida";
  }
}

// Obtiene info básica del dispositivo/navegador
function getDispositivoInfo() {
  const ua = navigator.userAgent;
  let sistema = "Desconocido";
  let navegador = "Desconocido";

  if (/Windows/.test(ua)) sistema = "Windows";
  else if (/Android/.test(ua)) sistema = "Android";
  else if (/iPhone|iPad/.test(ua)) sistema = "iOS";
  else if (/Mac/.test(ua)) sistema = "Mac";
  else if (/Linux/.test(ua)) sistema = "Linux";

  if (/Chrome/.test(ua) && !/Edg/.test(ua)) navegador = "Chrome";
  else if (/Firefox/.test(ua)) navegador = "Firefox";
  else if (/Edg/.test(ua)) navegador = "Edge";
  else if (/Safari/.test(ua) && !/Chrome/.test(ua)) navegador = "Safari";

  return `${sistema} — ${navegador}`;
}