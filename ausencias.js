// ausencias.js — Notificación automática de ausencias KRD Importaciones
// Si un colaborador no registra entrada antes de las 11:00 AM (PE),
// se envía alerta al admin por WhatsApp (una sola vez por día).

const _AUSENCIAS_KEY = "krd_ausencias_";

function _peruNow() {
  const ahora = new Date();
  const utcMs = ahora.getTime() + ahora.getTimezoneOffset() * 60000;
  return new Date(utcMs - 5 * 3600000);
}

async function verificarAusencias() {
  if (typeof isAdmin !== "function" || !isAdmin()) return;

  const peru   = _peruNow();
  const hoy    = `${peru.getFullYear()}-${String(peru.getMonth() + 1).padStart(2, "0")}-${String(peru.getDate()).padStart(2, "0")}`;
  const llave  = _AUSENCIAS_KEY + hoy;

  if (localStorage.getItem(llave)) return;

  const minActual = peru.getHours() * 60 + peru.getMinutes();
  if (minActual < 11 * 60) return; // Antes de 11:00 AM no actuar

  // Colaboradores activos (todos los que no son admin)
  const { data: perfiles, error: perfilesErr } = await supabaseClient
    .from("perfiles")
    .select("display_name, username")
    .neq("rol", "admin");

  if (perfilesErr || !perfiles?.length) {
    localStorage.setItem(llave, "sin-colaboradores");
    return;
  }

  // Registros de entrada de hoy
  const { data: entradas } = await supabaseClient
    .from("asistencia")
    .select("nombre")
    .eq("fecha", hoy);

  const presentes = new Set(
    (entradas || []).map((r) => (r.nombre || "").toLowerCase().trim())
  );

  const ausentes = perfiles.filter((p) => {
    const nombre = (p.display_name || p.username || "").toLowerCase().trim();
    return nombre && !presentes.has(nombre);
  });

  localStorage.setItem(llave, ausentes.length ? "notificado" : "todos-presentes");

  if (!ausentes.length) return;

  const horaStr    = `${String(peru.getHours()).padStart(2, "0")}:${String(peru.getMinutes()).padStart(2, "0")}`;
  const fechaLeg   = peru.toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const lista      = ausentes.map((p) => `• ${p.display_name || p.username}`).join("\n");

  const waMsg = `🚨 *KRD Importaciones — AUSENCIAS*\n\n📅 ${fechaLeg}\n🕐 Verificado: ${horaStr} (PE)\n\n⚠️ Sin registro de entrada:\n\n${lista}\n\n_Notificación automática del sistema_`;

  if (typeof enviarWhatsApp === "function") await enviarWhatsApp(waMsg);
  if (typeof mostrarToast === "function")
    mostrarToast(`⚠️ ${ausentes.length} colaborador(es) sin entrada hoy.`, "error");
}
