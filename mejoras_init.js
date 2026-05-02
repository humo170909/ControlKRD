// ══════════════════════════════════════════════
// MEJORAS_INIT.JS — KRD Importaciones
// Inicializa todos los módulos nuevos.
// Pegar el contenido de este archivo al FINAL
// de tu main.js existente (o incluirlo como
// <script src="mejoras_init.js"></script>
// DESPUÉS de todos los demás scripts)
// ══════════════════════════════════════════════

// ─── PATCH: renderAsistencia extendido ────────
// Envuelve la función original para que también
// actualice el gráfico y top-colabs al cambiar datos.

const _renderAsistenciaOriginal = typeof renderAsistencia === "function" ? renderAsistencia : null;

async function renderAsistencia() {
  // 1. Obtener datos frescos
  const lista = await getAsistencias();

  // 2. Actualizar contador total
  const totalEl = document.getElementById("totalAsistencias");
  if (totalEl) totalEl.textContent = `${lista.length} registro${lista.length !== 1 ? "s" : ""} en este mes`;

  // 3. Guardar para los filtros
  if (typeof setAsistenciasFull === "function") setAsistenciasFull(lista);

  // 4. Render de la tabla con filtros activos
  if (typeof aplicarFiltrosAsistencia === "function") {
    aplicarFiltrosAsistencia();
  } else {
    const tbody = document.getElementById("bodyAsistencia");
    const empty = document.getElementById("emptyAsistencia");
    document.getElementById("totalAsistencias").textContent =
      `${lista.length} registro${lista.length !== 1 ? "s" : ""} en este mes`;
    if (!lista.length) {
      tbody.innerHTML = "";
      empty.classList.remove("hidden");
    } else {
      empty.classList.add("hidden");
    }
  }

  // 5. Actualizar gráfico, ranking y quincenas (solo admin)
  if (isAdmin()) {
    renderGraficoAsistencia?.();
    renderTopColaboradores?.();
    await renderPanelQuincenas?.();  // ← única línea nueva
  }
}

// ─── PATCH: observaciones extendido ───────────
// Llama al setter del caché cuando se renderizan observaciones.
// Si tu observaciones.js ya tiene una función de render,
// agrega esta línea al final de ella:
//   setObservacionesFull(lista); aplicarFiltrosObs();
// O si usas una función llamada renderObservaciones(), parchéala aquí:

if (typeof window !== "undefined") {
  const _origRenderObs = window.renderObservaciones;
  if (typeof _origRenderObs === "function") {
    window.renderObservaciones = async function (...args) {
      await _origRenderObs.apply(this, args);
      // Recapturar lista del DOM o re-fetch
      // Si tu función ya actualiza tbody, capturamos desde Supabase:
      const mesId = typeof getMesActivo === "function" ? getMesActivo() : null;
      // No hacemos doble fetch aquí; el caché se actualiza al cargar observaciones
    };
  }
}

// ─── VERIFICACIÓN PERIÓDICA DE AUSENCIAS (cada 20 min) ──────
setInterval(() => {
  if (typeof verificarAusencias === "function") verificarAusencias();
}, 20 * 60 * 1000);

// ─── INICIALIZACIÓN AL CARGAR ─────────────────

document.addEventListener("DOMContentLoaded", async () => {

  // ── Inicializar filtros (inyectan HTML en sus wrappers) ──
  if (typeof initFiltrosAsistencia === "function") initFiltrosAsistencia();
  if (typeof initFiltrosObservaciones === "function") initFiltrosObservaciones();

  // ── Reloj y fecha ya los maneja tu main.js ──

  // ── Tab Usuarios: cargar al activarse ──
  document.querySelector('[data-tab="usuarios"]')?.addEventListener("click", async () => {
    if (isAdmin()) {
      await renderTablaUsuarios();
      await actualizarResumenUsuarios();
    }
  });

  // ── Cuando se activa tab de asistencia, cargar gráfico ──
  document.querySelector('[data-tab="asistencia"]')?.addEventListener("click", async () => {
    if (isAdmin()) {
      await renderGraficoAsistencia?.();
      await renderTopColaboradores?.();
    }
  });

  // ── Mostrar grid analytics de asistencia solo si es admin ──
  const gridAsist = document.getElementById("gridGraficoAsistencia");
  if (gridAsist && typeof isAdmin === "function" && isAdmin()) {
    gridAsist.classList.remove("hidden");
  }
});

// ─── RESUMEN USUARIOS ─────────────────────────

async function actualizarResumenUsuarios() {
  const lista = await getUsuarios();
  const activos   = lista.filter((u) => u.activo !== false).length;
  const inactivos = lista.filter((u) => u.activo === false).length;
  const admins    = lista.filter((u) => u.rol === "admin").length;

  const setTxt = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  setTxt("totalUsuariosCount", lista.length);
  setTxt("totalActivosCount", activos);
  setTxt("totalInactivosCount", inactivos);
  setTxt("totalAdminsCount", admins);
}

// ─── PATCH: después del login exitoso ─────────
// Si tu auth.js llama a una función onLoginSuccess() o similar,
// añade dentro de ella:
//   if (isAdmin()) { renderGraficoAsistencia(); renderTopColaboradores(); }
// O parchea aquí el evento que dispara el login:

(function patchPostLogin() {
  // Esperamos a que el appScreen sea visible para disparar renders iniciales
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((m) => {
      if (m.type === "attributes" && m.attributeName === "class") {
        const app = document.getElementById("appScreen");
        if (app && !app.classList.contains("hidden")) {
          observer.disconnect();
          if (typeof isAdmin === "function" && isAdmin()) {
            // Mostrar secciones de admin
            document.querySelectorAll(".admin-only").forEach((el) => el.classList.remove("hidden"));
            document.querySelectorAll(".tab-admin-only").forEach((el) => el.classList.remove("hidden"));
            // Render inicial gráficos asistencia + verificar ausencias
            setTimeout(() => {
              renderGraficoAsistencia?.();
              renderTopColaboradores?.();
              if (typeof verificarAusencias === "function") verificarAusencias();
            }, 600);
          }
        }
      }
    });
  });
  const app = document.getElementById("appScreen");
  if (app) observer.observe(app, { attributes: true });
})();