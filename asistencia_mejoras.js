// ══════════════════════════════════════════════════════════════
// asistencia_mejoras.js — KRD Importaciones
// ══════════════════════════════════════════════════════════════

function calcMinutos(entrada, salida) {
  if (!entrada || !salida) return 0;
  const [hE, mE] = entrada.split(":").map(Number);
  const [hS, mS] = salida.split(":").map(Number);
  const diff = (hS * 60 + mS) - (hE * 60 + mE);
  return diff > 0 ? diff : 0;
}

function minToHHMM(min) {
  if (!min || min <= 0) return "0h 0m";
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

function getQuincena(fecha) {
  if (!fecha) return null;
  const dia = parseInt(fecha.split("-")[2]);
  return dia <= 15 ? 1 : 2;
}

function calcularQuincenas(lista) {
  const q = {
    1: { tardanzas: 0, minutos: 0, registros: [] },
    2: { tardanzas: 0, minutos: 0, registros: [] },
  };
  lista.forEach(r => {
    const qNum = getQuincena(r.fecha);
    if (!qNum) return;
    const estado = r.estado || getEstadoAsistencia(r.entrada);
    const min = calcMinutos(r.entrada, r.salida);
    q[qNum].minutos += min;
    q[qNum].registros.push(r);
    if (estado === "Tardanza") q[qNum].tardanzas++;
  });
  return q;
}

async function renderPanelQuincenas() {
  if (!isAdmin()) return;
  const contenedor = document.getElementById("panelQuincenasContenido");
  if (!contenedor) return;

  const lista = await getAsistencias();
  if (!lista.length) {
    contenedor.innerHTML = `<p style="color:#7d8590;font-size:0.82rem;text-align:center;padding:1rem 0">Sin datos para este mes.</p>`;
    return;
  }

  const q = calcularQuincenas(lista);

  const porUsuario = {};
  lista.forEach(r => {
    const key = r.nombre;
    if (!porUsuario[key]) porUsuario[key] = { 1: { tardanzas: 0, minutos: 0 }, 2: { tardanzas: 0, minutos: 0 } };
    const qNum = getQuincena(r.fecha);
    if (!qNum) return;
    const estado = r.estado || getEstadoAsistencia(r.entrada);
    porUsuario[key][qNum].minutos += calcMinutos(r.entrada, r.salida);
    if (estado === "Tardanza") porUsuario[key][qNum].tardanzas++;
  });

  const filas = Object.entries(porUsuario).map(([nombre, data]) => `
    <tr>
      <td style="padding:8px 12px;font-size:0.82rem;color:#e6edf3;border-bottom:0.5px solid #21262d">${sanitize(nombre)}</td>
      <td style="padding:8px 12px;text-align:center;font-family:monospace;font-size:0.82rem;color:${data[1].tardanzas>0?'#f85149':'#3fb950'};border-bottom:0.5px solid #21262d">${data[1].tardanzas}</td>
      <td style="padding:8px 12px;text-align:center;font-family:monospace;font-size:0.82rem;color:#58a6ff;border-bottom:0.5px solid #21262d">${minToHHMM(data[1].minutos)}</td>
      <td style="padding:8px 12px;text-align:center;font-family:monospace;font-size:0.82rem;color:${data[2].tardanzas>0?'#f85149':'#3fb950'};border-bottom:0.5px solid #21262d">${data[2].tardanzas}</td>
      <td style="padding:8px 12px;text-align:center;font-family:monospace;font-size:0.82rem;color:#58a6ff;border-bottom:0.5px solid #21262d">${minToHHMM(data[2].minutos)}</td>
    </tr>
  `).join("");

  contenedor.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
      <div style="background:#161b22;border:0.5px solid #30363d;border-radius:10px;padding:14px 16px">
        <div style="font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#7d8590;font-family:monospace;margin-bottom:8px">1ª Quincena (1–15)</div>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-size:10px;color:#7d8590;font-family:monospace">Tardanzas</div>
            <div style="font-size:20px;font-weight:600;color:${q[1].tardanzas>0?'#f85149':'#3fb950'};font-family:monospace">${q[1].tardanzas}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:10px;color:#7d8590;font-family:monospace">Horas trabajadas</div>
            <div style="font-size:20px;font-weight:600;color:#58a6ff;font-family:monospace">${minToHHMM(q[1].minutos)}</div>
          </div>
        </div>
      </div>
      <div style="background:#161b22;border:0.5px solid #30363d;border-radius:10px;padding:14px 16px">
        <div style="font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#7d8590;font-family:monospace;margin-bottom:8px">2ª Quincena (16–fin)</div>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-size:10px;color:#7d8590;font-family:monospace">Tardanzas</div>
            <div style="font-size:20px;font-weight:600;color:${q[2].tardanzas>0?'#f85149':'#3fb950'};font-family:monospace">${q[2].tardanzas}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:10px;color:#7d8590;font-family:monospace">Horas trabajadas</div>
            <div style="font-size:20px;font-weight:600;color:#58a6ff;font-family:monospace">${minToHHMM(q[2].minutos)}</div>
          </div>
        </div>
      </div>
    </div>

    <div style="background:#161b22;border:0.5px solid #30363d;border-radius:10px;overflow:hidden">
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:#0d1117">
            <th style="padding:9px 12px;text-align:left;font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#7d8590;font-family:monospace">Trabajador</th>
            <th style="padding:9px 12px;text-align:center;font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#7d8590;font-family:monospace">Tard. Q1</th>
            <th style="padding:9px 12px;text-align:center;font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#7d8590;font-family:monospace">Hrs. Q1</th>
            <th style="padding:9px 12px;text-align:center;font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#7d8590;font-family:monospace">Tard. Q2</th>
            <th style="padding:9px 12px;text-align:center;font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#7d8590;font-family:monospace">Hrs. Q2</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
    </div>
  `;
}

async function descargarExcelAsistencia() {
  if (!isAdmin()) return;
  mostrarToast("Generando Excel...", "info");

  const lista = await getAsistencias();
  if (!lista.length) {
    mostrarToast("No hay datos para exportar.", "error");
    return;
  }

  const meses = await getMesesAsistencia();
  const mesId = getMesActivoAsistencia();
  const mesNombre = meses.find(m => m.id === mesId)?.nombre || "Asistencia";
  const q = calcularQuincenas(lista);

  const filas = lista.map(r => {
    const estado = r.estado || getEstadoAsistencia(r.entrada);
    const min = calcMinutos(r.entrada, r.salida);
    const horas = min > 0 ? (min / 60).toFixed(2) : "0.00";
    const qNum = getQuincena(r.fecha);
    return [
      r.nombre || "",
      r.fecha || "",
      r.entrada || "",
      r.salida || "",
      estado,
      horas,
      r.justificacion || "",
      qNum === 1 ? "Q1 (1-15)" : "Q2 (16-fin)",
      r.registrado_por || "",
    ];
  });

  const resumen = [
    [],
    ["RESUMEN POR QUINCENA"],
    ["Período", "Total registros", "Tardanzas", "Horas trabajadas"],
    ["Q1 (días 1-15)", q[1].registros.length, q[1].tardanzas, (q[1].minutos / 60).toFixed(2)],
    ["Q2 (días 16-fin)", q[2].registros.length, q[2].tardanzas, (q[2].minutos / 60).toFixed(2)],
  ];

  const wb = XLSX.utils.book_new();

  const wsData = [
    ["Nombre", "Fecha", "Hora Ingreso", "Hora Salida", "Estado", "Horas Trabajadas", "Justificación", "Quincena", "Registrado por"],
    ...filas,
    ...resumen,
  ];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = [
    { wch: 22 }, { wch: 12 }, { wch: 13 }, { wch: 13 },
    { wch: 12 }, { wch: 16 }, { wch: 30 }, { wch: 14 }, { wch: 18 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, "Asistencia");

  const porUsuario = {};
  lista.forEach(r => {
    if (!porUsuario[r.nombre]) porUsuario[r.nombre] = { q1_tard: 0, q1_min: 0, q2_tard: 0, q2_min: 0, total: 0 };
    const estado = r.estado || getEstadoAsistencia(r.entrada);
    const min = calcMinutos(r.entrada, r.salida);
    const qNum = getQuincena(r.fecha);
    porUsuario[r.nombre].total++;
    if (qNum === 1) { porUsuario[r.nombre].q1_min += min; if (estado === "Tardanza") porUsuario[r.nombre].q1_tard++; }
    else            { porUsuario[r.nombre].q2_min += min; if (estado === "Tardanza") porUsuario[r.nombre].q2_tard++; }
  });

  const ws2Data = [
    ["Trabajador", "Registros", "Tardanzas Q1", "Horas Q1", "Tardanzas Q2", "Horas Q2", "Total Horas"],
    ...Object.entries(porUsuario).map(([nom, d]) => [
      nom, d.total, d.q1_tard,
      (d.q1_min / 60).toFixed(2),
      d.q2_tard,
      (d.q2_min / 60).toFixed(2),
      ((d.q1_min + d.q2_min) / 60).toFixed(2),
    ]),
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(ws2Data);
  ws2["!cols"] = [{ wch: 22 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 13 }];
  XLSX.utils.book_append_sheet(wb, ws2, "Resumen por Trabajador");

  XLSX.writeFile(wb, `KRD_Asistencia_${mesNombre.replace(/\s+/g, "_")}.xlsx`);
  mostrarToast("✓ Excel descargado correctamente.", "success");
  await audit("export", `Exportación Excel asistencia: ${mesNombre}`);
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btnDescargarAsistencia")?.addEventListener("click", descargarExcelAsistencia);
});