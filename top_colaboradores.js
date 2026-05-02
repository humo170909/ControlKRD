// ══════════════════════════════════════════════
// TOP COLABORADORES — KRD Importaciones
// Ranking de puntualidad del mes
// ══════════════════════════════════════════════

async function renderTopColaboradores() {
  if (!isAdmin()) return;

  const contenedor = document.getElementById("topColabContenedor");
  if (!contenedor) return;

  const mesId = getMesActivoAsistencia();
  if (!mesId) {
    contenedor.innerHTML = `<p style="font-size:0.82rem;color:var(--text-muted);text-align:center;padding:1rem">
      Selecciona un mes de asistencia.</p>`;
    return;
  }

  const { data, error } = await supabaseClient
    .from("asistencia")
    .select("nombre, estado, entrada")
    .eq("mes_asist_id", mesId);

  if (error || !data || !data.length) {
    contenedor.innerHTML = `<p style="font-size:0.82rem;color:var(--text-muted);text-align:center;padding:1rem">
      Sin registros este mes.</p>`;
    return;
  }

  // Agrupar por colaborador
  const colab = {};
  data.forEach((r) => {
    const n = r.nombre?.trim();
    if (!n) return;
    if (!colab[n]) colab[n] = { asistencias: 0, tardanzas: 0, minutosExtra: 0 };
    const estado = r.estado || getEstadoAsistencia(r.entrada);
    if (estado === "Tardanza") {
      colab[n].tardanzas++;
      // Calcular minutos de tardanza (referencia: 10:20)
      if (r.entrada) {
        const [h, m] = r.entrada.split(":").map(Number);
        const minutos = h * 60 + m - (10 * 60 + 20);
        if (minutos > 0) colab[n].minutosExtra += minutos;
      }
    } else {
      colab[n].asistencias++;
    }
  });

  // Ordenar: más asistencias primero, menos tardanzas como desempate
  const ranking = Object.entries(colab)
    .map(([nombre, s]) => ({
      nombre,
      asistencias: s.asistencias,
      tardanzas: s.tardanzas,
      minutosExtra: s.minutosExtra,
      total: s.asistencias + s.tardanzas,
      pct: s.asistencias + s.tardanzas > 0
        ? ((s.asistencias / (s.asistencias + s.tardanzas)) * 100).toFixed(0)
        : 0,
    }))
    .sort((a, b) => {
      if (b.asistencias !== a.asistencias) return b.asistencias - a.asistencias;
      return a.tardanzas - b.tardanzas;
    });

  const medallas = ["🥇", "🥈", "🥉"];

  contenedor.innerHTML = ranking.map((c, i) => {
    const pct = parseInt(c.pct);
    const color = pct >= 90 ? "#4ecb8d" : pct >= 70 ? "#f59e0b" : "#ef4444";
    const medalla = medallas[i] || `#${i + 1}`;
    return `
      <div style="
        display:flex;align-items:center;gap:0.75rem;
        padding:0.65rem 0.85rem;
        background:rgba(255,255,255,0.03);
        border:1px solid rgba(255,255,255,0.06);
        border-radius:8px;
        margin-bottom:0.5rem;
        transition:background 0.15s ease;
      " onmouseover="this.style.background='rgba(255,255,255,0.06)'"
         onmouseout="this.style.background='rgba(255,255,255,0.03)'">
        <div style="font-size:1.3rem;min-width:28px;text-align:center">${medalla}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:0.85rem;font-weight:600;color:var(--text-primary);
            white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
            ${sanitize(c.nombre)}
          </div>
          <div style="font-size:0.72rem;color:var(--text-secondary);margin-top:1px">
            ✓ ${c.asistencias} puntual${c.asistencias !== 1 ? "es" : ""} ·
            ${c.tardanzas > 0
              ? `<span style="color:#ef4444">⏰ ${c.tardanzas} tardanza${c.tardanzas !== 1 ? "s" : ""}</span>`
              : `<span style="color:#4ecb8d">Sin tardanzas</span>`}
          </div>
          <div style="margin-top:5px;background:rgba(255,255,255,0.08);border-radius:999px;height:5px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:${color};border-radius:999px;transition:width 0.6s ease"></div>
          </div>
        </div>
        <div style="font-size:1rem;font-weight:700;color:${color};min-width:38px;text-align:right">
          ${c.pct}%
        </div>
      </div>
    `;
  }).join("") || `<p style="font-size:0.82rem;color:var(--text-muted);text-align:center;padding:1rem">Sin datos.</p>`;
}