// ══════════════════════════════════════════════
// FILTROS Y BÚSQUEDA EN TABLAS — KRD Importaciones
// Asistencias: por nombre / estado
// Observaciones: por fecha / colaborador
// ══════════════════════════════════════════════

// ─── FILTRO ASISTENCIAS ───────────────────────

let _asistenciasFull = []; // cache de registros completos

function initFiltrosAsistencia() {
  const wrap = document.getElementById("filtrosAsistenciaWrap");
  if (!wrap) return;

  wrap.innerHTML = `
    <div style="display:flex;gap:0.6rem;align-items:center;flex-wrap:wrap;margin-bottom:0.85rem">
      <div style="position:relative;flex:1;min-width:160px">
        <svg style="position:absolute;left:10px;top:50%;transform:translateY(-50%);
          color:var(--text-muted);pointer-events:none"
          width="13" height="13" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input type="text" id="filtroAsistNombre"
          placeholder="Buscar por nombre..."
          style="width:100%;padding:7px 10px 7px 30px;background:var(--bg-input);
            border:1px solid var(--border);border-radius:var(--radius);
            color:var(--text-primary);font-size:0.82rem;font-family:var(--font-body);
            outline:none;transition:border-color 0.15s"
          oninput="aplicarFiltrosAsistencia()"
          onfocus="this.style.borderColor='var(--border-focus)'"
          onblur="this.style.borderColor='var(--border)'" />
      </div>
      <select id="filtroAsistEstado"
        style="padding:7px 10px;background:var(--bg-input);border:1px solid var(--border);
          border-radius:var(--radius);color:var(--text-primary);font-size:0.82rem;
          font-family:var(--font-body);outline:none;cursor:pointer"
        onchange="aplicarFiltrosAsistencia()">
        <option value="">Todos los estados</option>
        <option value="Asistencia">✓ Asistencia</option>
        <option value="Tardanza">⏰ Tardanza</option>
      </select>
      <button onclick="limpiarFiltrosAsistencia()"
        style="padding:7px 12px;background:transparent;border:1px solid var(--border);
          border-radius:var(--radius);color:var(--text-secondary);font-size:0.78rem;
          cursor:pointer;font-family:var(--font-body);transition:all 0.15s"
        onmouseover="this.style.borderColor='var(--accent)';this.style.color='var(--accent)'"
        onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--text-secondary)'">
        ✕ Limpiar
      </button>
      <span id="filtroAsistCount" style="font-size:0.76rem;color:var(--text-muted);margin-left:auto"></span>
    </div>
  `;
}

function setAsistenciasFull(lista) {
  _asistenciasFull = lista;
}

function aplicarFiltrosAsistencia() {
  const nombre = (document.getElementById("filtroAsistNombre")?.value || "").toLowerCase().trim();
  const estado = document.getElementById("filtroAsistEstado")?.value || "";

  const filtrados = _asistenciasFull.filter((r) => {
    const matchNombre = !nombre || (r.nombre || "").toLowerCase().includes(nombre);
    const estadoReal = r.estado || getEstadoAsistencia(r.entrada);
    const matchEstado = !estado || estadoReal === estado;
    return matchNombre && matchEstado;
  });

  renderBodyAsistencia(filtrados);

  const countEl = document.getElementById("filtroAsistCount");
  if (countEl) {
    countEl.textContent = nombre || estado
      ? `${filtrados.length} de ${_asistenciasFull.length} registro${_asistenciasFull.length !== 1 ? "s" : ""}`
      : "";
  }
}

function limpiarFiltrosAsistencia() {
  const inp = document.getElementById("filtroAsistNombre");
  const sel = document.getElementById("filtroAsistEstado");
  if (inp) inp.value = "";
  if (sel) sel.value = "";
  aplicarFiltrosAsistencia();
}

function renderBodyAsistencia(lista) {
  const tbody = document.getElementById("bodyAsistencia");
  const empty = document.getElementById("emptyAsistencia");
  if (!lista.length) {
    tbody.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");
  tbody.innerHTML = lista.map((r, i) => {
    const estado = r.estado || getEstadoAsistencia(r.entrada);
    const estadoBadge = estado === "Tardanza"
      ? `<span style="background:#fee2e2;color:#ef4444;padding:2px 8px;border-radius:999px;font-size:0.72rem;font-weight:600">⏰ Tardanza</span>`
      : estado === "Asistencia"
      ? `<span style="background:#d1fae5;color:#059669;padding:2px 8px;border-radius:999px;font-size:0.72rem;font-weight:600">✓ Asistencia</span>`
      : `<span style="color:var(--text-muted)">—</span>`;
    const justificacion = r.justificacion ? sanitize(r.justificacion) : "";
    const justificacionShort = justificacion
      ? (justificacion.length > 50 ? `${justificacion.slice(0, 50)}...` : justificacion)
      : "—";
    return `
    <tr>
      <td>${i + 1}</td>
      <td>${sanitize(r.nombre)}</td>
      <td class="val-mono" style="font-size:0.78rem;color:var(--text-muted)">${r.fecha || ""}</td>
      <td class="val-mono">${r.entrada}</td>
      <td class="val-mono">${r.salida || '<span style="color:var(--text-muted)">—</span>'}</td>
      <td class="val-mono">${calcHoras(r.entrada, r.salida)}</td>
      <td>${estadoBadge}</td>
      <td title="${justificacion}">${justificacionShort}</td>
      <td><span class="reg-by">${sanitize(r.registrado_por || "—")}</span></td>
      <td>${isAdmin() ? `<button class="btn-delete" onclick="delAsistencia('${r.id}')">✕</button>` : ""}</td>
    </tr>`;
  }).join("");
}

// ─── FILTRO OBSERVACIONES ─────────────────────

let _observacionesFull = [];

function initFiltrosObservaciones() {
  const wrap = document.getElementById("filtrosObsWrap");
  if (!wrap) return;

  wrap.innerHTML = `
    <div style="display:flex;gap:0.6rem;align-items:center;flex-wrap:wrap;margin-bottom:0.85rem">
      <div style="position:relative;flex:1;min-width:160px">
        <svg style="position:absolute;left:10px;top:50%;transform:translateY(-50%);
          color:var(--text-muted);pointer-events:none"
          width="13" height="13" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input type="text" id="filtroObsColab"
          placeholder="Buscar por colaborador..."
          style="width:100%;padding:7px 10px 7px 30px;background:var(--bg-input);
            border:1px solid var(--border);border-radius:var(--radius);
            color:var(--text-primary);font-size:0.82rem;font-family:var(--font-body);
            outline:none;transition:border-color 0.15s"
          oninput="aplicarFiltrosObs()"
          onfocus="this.style.borderColor='var(--border-focus)'"
          onblur="this.style.borderColor='var(--border)'" />
      </div>
      <input type="date" id="filtroObsFecha"
        style="padding:7px 10px;background:var(--bg-input);border:1px solid var(--border);
          border-radius:var(--radius);color:var(--text-primary);font-size:0.82rem;
          font-family:var(--font-body);outline:none;cursor:pointer"
        onchange="aplicarFiltrosObs()" />
      <button onclick="limpiarFiltrosObs()"
        style="padding:7px 12px;background:transparent;border:1px solid var(--border);
          border-radius:var(--radius);color:var(--text-secondary);font-size:0.78rem;
          cursor:pointer;font-family:var(--font-body);transition:all 0.15s"
        onmouseover="this.style.borderColor='var(--accent)';this.style.color='var(--accent)'"
        onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--text-secondary)'">
        ✕ Limpiar
      </button>
      <span id="filtroObsCount" style="font-size:0.76rem;color:var(--text-muted);margin-left:auto"></span>
    </div>
  `;
}

function setObservacionesFull(lista) {
  _observacionesFull = lista;
}

function aplicarFiltrosObs() {
  const colab = (document.getElementById("filtroObsColab")?.value || "").toLowerCase().trim();
  const fecha = document.getElementById("filtroObsFecha")?.value || "";

  const filtrados = _observacionesFull.filter((r) => {
    const matchColab = !colab || (r.nombre || r.colaborador || "").toLowerCase().includes(colab);
    const fechaReg = (r.creado_en || r.fecha || "").slice(0, 10);
    const matchFecha = !fecha || fechaReg === fecha;
    return matchColab && matchFecha;
  });

  renderBodyObservaciones(filtrados);

  const countEl = document.getElementById("filtroObsCount");
  if (countEl) {
    countEl.textContent = colab || fecha
      ? `${filtrados.length} de ${_observacionesFull.length}`
      : "";
  }
}

function limpiarFiltrosObs() {
  const inp = document.getElementById("filtroObsColab");
  const inp2 = document.getElementById("filtroObsFecha");
  if (inp) inp.value = "";
  if (inp2) inp2.value = "";
  aplicarFiltrosObs();
}

// Esta función debe ser compatible con tu renderBodyObservaciones existente
// Se llama desde observaciones.js — asegúrate de que esa función exista o renómbrala aquí
function renderBodyObservaciones(lista) {
  const tbody = document.getElementById("bodyObservaciones");
  const empty = document.getElementById("emptyObservaciones");
  const totalEl = document.getElementById("totalObservaciones");

  if (totalEl) totalEl.textContent = `${lista.length} observacion${lista.length !== 1 ? "es" : ""}`;

  if (!lista.length) {
    tbody.innerHTML = "";
    if (empty) empty.classList.remove("hidden");
    return;
  }
  if (empty) empty.classList.add("hidden");

  // Reutiliza el formato de tu renderObservaciones existente
  tbody.innerHTML = lista.map((obs, i) => {
    const fechaStr = obs.creado_en
      ? new Date(obs.creado_en).toLocaleString("es-PE", {
          day: "2-digit", month: "2-digit", year: "numeric",
          hour: "2-digit", minute: "2-digit",
        })
      : obs.fecha || "—";
    const leido = obs.leido || obs.estado === "leido";
    const estadoBadge = leido
      ? `<span style="background:rgba(78,203,141,0.15);color:#4ecb8d;padding:2px 8px;border-radius:999px;font-size:0.72rem">Leída</span>`
      : `<span style="background:rgba(245,158,11,0.15);color:#f59e0b;padding:2px 8px;border-radius:999px;font-size:0.72rem">Pendiente</span>`;
    const nombre = sanitize(obs.nombre || obs.colaborador || "—");
    return `
      <tr>
        <td>${i + 1}</td>
        <td style="font-size:0.78rem;color:var(--text-muted)">${fechaStr}</td>
        ${isAdmin() ? `<td>${nombre}</td>` : ""}
        <td style="max-width:320px;word-break:break-word">${sanitize(obs.texto || obs.mensaje || "")}</td>
        <td>${estadoBadge}</td>
        ${isAdmin() ? `
          <td>
            ${!leido ? `<button class="btn btn-sm btn-ghost" onclick="marcarObsLeida('${obs.id}')" style="font-size:0.72rem">✓ Marcar leída</button>` : ""}
            <button class="btn-delete" onclick="eliminarObservacion('${obs.id}')" style="margin-left:4px">✕</button>
          </td>` : ""}
      </tr>`;
  }).join("");
}