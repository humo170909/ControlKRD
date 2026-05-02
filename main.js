// main.js — Inicialización KRD Importaciones

(async function init() {
  // Crear modal de estado de entrada dinámicamente si no existe
  if (!document.getElementById("modalEstadoEntradaOverlay")) {
    const div = document.createElement("div");
    div.id = "modalEstadoEntradaOverlay";
    div.className = "modal-overlay";
    div.style.cssText =
      "display:none;align-items:center;justify-content:center;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.6);";
    div.innerHTML = `
      <div class="modal-card" style="max-width:380px;text-align:center;padding:2rem;background:var(--surface,#1e1e2e);border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,0.5);">
        <div id="estadoEntradaIcon" style="font-size:3.5rem;margin-bottom:12px"></div>
        <h3 id="estadoEntradaTitle" style="margin-bottom:10px;font-size:1.15rem;font-weight:700"></h3>
        <p id="estadoEntradaDesc" style="color:var(--text-secondary,#94a3b8);font-size:0.88rem;margin-bottom:22px;line-height:1.6"></p>
        <button id="estadoEntradaOk" class="btn btn-primary" style="width:100%;font-size:0.95rem">Aceptar</button>
      </div>`;
    document.body.appendChild(div);
  }

  const session = getSession();
  if (session) {
    await mostrarApp(session);
  } else {
    mostrarLogin();
  }

  // CORRECCIÓN: verificar que el elemento exista antes de asignar valor
  const fechaVentaEl = document.getElementById("fechaVenta");
  if (fechaVentaEl) fechaVentaEl.value = getTodayStr();
})();
