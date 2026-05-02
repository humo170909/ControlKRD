async function renderGraficoAsistencia() {
  if (!isAdmin()) return;
  const contenedor = document.getElementById("graficoAsistenciaContenedor");
  if (!contenedor) return;

  const mesId = getMesActivoAsistencia();
  if (!mesId) {
    contenedor.innerHTML = `<div style="text-align:center;padding:2rem;color:#7d8590"><div style="font-size:1.8rem">📅</div><p style="font-size:0.85rem;margin-top:0.5rem">Selecciona un mes para ver el gráfico.</p></div>`;
    return;
  }

  const { data, error } = await supabaseClient
    .from("asistencia").select("fecha,estado,entrada")
    .eq("mes_asist_id", mesId).order("fecha", { ascending: true });

  if (error || !data?.length) {
    contenedor.innerHTML = `<div style="text-align:center;padding:2rem;color:#7d8590"><div style="font-size:1.8rem">📊</div><p style="font-size:0.85rem;margin-top:0.5rem">Sin datos de asistencia.</p></div>`;
    return;
  }

  const semanasData = {};
  data.forEach(r => {
    if (!r.fecha) return;
    const key = `Sem ${Math.ceil(new Date(r.fecha + 'T12:00:00').getDate() / 7)}`;
    if (!semanasData[key]) semanasData[key] = { asistencias: 0, tardanzas: 0 };
    (r.estado || getEstadoAsistencia(r.entrada)) === 'Tardanza'
      ? semanasData[key].tardanzas++
      : semanasData[key].asistencias++;
  });

  const labels   = Object.keys(semanasData);
  const asistArr = labels.map(k => semanasData[k].asistencias);
  const tardArr  = labels.map(k => semanasData[k].tardanzas);
  const totalA   = asistArr.reduce((a, b) => a + b, 0);
  const totalT   = tardArr.reduce((a, b) => a + b, 0);
  const pct      = totalA + totalT > 0 ? ((totalA / (totalA + totalT)) * 100).toFixed(1) : '—';

  if (window._chartAsist instanceof Chart) {
    window._chartAsist.destroy();
    window._chartAsist = null;
  }

  contenedor.innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px">
      <div>
        <div style="font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#7d8590;font-family:monospace">Asistencia vs Tardanzas</div>
        <div style="font-size:22px;font-weight:600;color:#e6edf3;margin-top:4px;font-family:monospace">${pct}%</div>
      </div>
      <span style="font-size:11px;font-weight:500;padding:3px 10px;border-radius:20px;font-family:monospace;
        background:rgba(139,148,158,.1);color:#8b949e;border:0.5px solid rgba(139,148,158,.2)">Puntualidad</span>
    </div>
    <div style="position:relative;height:200px">
      <canvas id="_cvAsist" role="img" aria-label="Barras de asistencia y tardanzas por semana">Asistencia por semana.</canvas>
    </div>
    <div style="display:flex;gap:16px;margin-top:12px;flex-wrap:wrap">
      <span style="display:flex;align-items:center;gap:6px;font-size:11px;color:#8b949e;font-family:monospace">
        <span style="width:10px;height:10px;border-radius:2px;background:#3fb950;display:inline-block"></span>Asistencia (${totalA})
      </span>
      <span style="display:flex;align-items:center;gap:6px;font-size:11px;color:#8b949e;font-family:monospace">
        <span style="width:10px;height:10px;border-radius:2px;background:#f85149;display:inline-block"></span>Tardanza (${totalT})
      </span>
    </div>
  `;

  const valueLabelsPlugin = {
    id: 'valueLabels',
    afterDatasetsDraw(chart) {
      const { ctx, data } = chart;
      data.datasets.forEach((ds, di) => {
        chart.getDatasetMeta(di).data.forEach((bar, i) => {
          const val = ds.data[i];
          if (!val) return;
          ctx.fillStyle = di === 0 ? '#3fb950' : '#f85149';
          ctx.font = '500 10px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(val, bar.x, bar.y - 3);
        });
      });
    }
  };

  window._chartAsist = new Chart(document.getElementById('_cvAsist').getContext('2d'), {
    type: 'bar',
    plugins: [valueLabelsPlugin],
    data: {
      labels,
      datasets: [
        {
          label: 'Asistencia',
          data: asistArr,
          backgroundColor: 'rgba(63,185,80,0.85)',
          hoverBackgroundColor: 'rgba(63,185,80,1)',
          borderRadius: { topLeft: 5, topRight: 5 },
          borderSkipped: false,
          barPercentage: .65,
          categoryPercentage: .7
        },
        {
          label: 'Tardanza',
          data: tardArr,
          backgroundColor: 'rgba(248,81,73,0.85)',
          hoverBackgroundColor: 'rgba(248,81,73,1)',
          borderRadius: { topLeft: 5, topRight: 5 },
          borderSkipped: false,
          barPercentage: .65,
          categoryPercentage: .7
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#21262d',
          borderColor: '#30363d',
          borderWidth: 1,
          titleColor: '#8b949e',
          bodyColor: '#e6edf3',
          padding: 12,
          titleFont: { size: 10.5, family: 'monospace' },
          bodyFont: { size: 12, family: 'monospace' },
          callbacks: { label: item => '  ' + item.dataset.label + ': ' + item.raw }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#7d8590', font: { size: 10 } }, border: { color: 'transparent' } },
        y: { grid: { color: 'rgba(48,54,61,0.6)', drawTicks: false }, ticks: { color: '#7d8590', font: { size: 10 }, stepSize: 5 }, border: { color: 'transparent' }, min: 0 }
      }
    }
  });
}