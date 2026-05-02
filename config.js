// ============================================================
// config.js — KRD Importaciones
// ADVERTENCIA DE SEGURIDAD: La SUPABASE_KEY aquí es la clave
// "publishable" (anon key), que es segura para exponer en el
// cliente SIEMPRE QUE tengas Row Level Security (RLS) activado
// en Supabase. Verifica que RLS esté habilitado en todas tus
// tablas desde el panel de Supabase → Authentication → Policies.
// ============================================================

const SUPABASE_URL = "https://vbphssxbfuthmkcldnkb.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZicGhzc3hiZnV0aG1rY2xkbmtiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NTMzMjIsImV4cCI6MjA5MDEyOTMyMn0.FHbdMKMWT9V2tf-Z0KGbZtKxcM1c30gX7GeRWXdvq10";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/* ── CallMeBot WhatsApp Config ── */
const WA_PHONE   = "51993100282";
const WA_APIKEY  = "3956084";

/* ── Claves de sessionStorage ── */
const SK_SESSION     = "krd_session";
const SK_LOGIN_FAILS = "krd_login_fails";
const SK_LOGIN_BLOCK = "krd_login_blocked_until";

/* ── Configuración de bloqueo por intentos fallidos ── */
const MAX_LOGIN_TRIES = 5;
const BLOCK_MS        = 2 * 60 * 1000; // 2 minutos

/* ── Gestión de intentos de login (localStorage: persiste entre pestañas) ── */
function getLoginFails() {
  return parseInt(localStorage.getItem(SK_LOGIN_FAILS) || "0", 10) || 0;
}

function incrementLoginFails() {
  const fails = getLoginFails() + 1;
  localStorage.setItem(SK_LOGIN_FAILS, String(fails));
  return fails;
}

function resetLoginFails() {
  localStorage.removeItem(SK_LOGIN_FAILS);
  localStorage.removeItem(SK_LOGIN_BLOCK);
}

function blockLogin() {
  const blockedUntil = Date.now() + BLOCK_MS;
  localStorage.setItem(SK_LOGIN_BLOCK, String(blockedUntil));
}

function getBlockSecondsLeft() {
  const blockedUntil = parseInt(localStorage.getItem(SK_LOGIN_BLOCK) || "0", 10);
  if (!blockedUntil || blockedUntil <= Date.now()) return 0;
  return Math.ceil((blockedUntil - Date.now()) / 1000);
}

function isLoginBlocked() {
  const blockedUntil = parseInt(localStorage.getItem(SK_LOGIN_BLOCK) || "0", 10);
  if (!blockedUntil) return false;
  if (blockedUntil <= Date.now()) {
    resetLoginFails();
    return false;
  }
  return true;
}

/* ── Gestión de sesión ── */
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

/* ── Reloj Perú (UTC-5) ── */
let _clockInterval = null;
function iniciarRelojPeru() {
  if (_clockInterval) clearInterval(_clockInterval);
  function tick() {
    const ahora  = new Date();
    const utcMs  = ahora.getTime() + ahora.getTimezoneOffset() * 60000;
    const peruMs = utcMs - 5 * 3600000;
    const peru   = new Date(peruMs);
    const hh = String(peru.getHours()).padStart(2, "0");
    const mm = String(peru.getMinutes()).padStart(2, "0");
    const ss = String(peru.getSeconds()).padStart(2, "0");
    const el = document.getElementById("headerClock");
    if (el) el.textContent = `🕐 ${hh}:${mm}:${ss} (PE)`;
  }
  tick();
  _clockInterval = setInterval(tick, 1000);
}
