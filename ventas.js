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
      await renderGraficoVentas();
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
    await renderGraficoVentas();
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

["ventaEfectivo", "ventaYape", "ventaPlin", "ventaTransf", "gananciaDelDia"].forEach((id) =>
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
    document.getElementById("fechaVenta").value = getTodayStr();
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
      "Estado",
      "Registrado por",
    ];
    const rows = asistencias.map((r, i) => {
      const fecha = r.fecha ? new Date(r.fecha + "T12:00:00") : null;
      const dia = fecha
        ? fecha.toLocaleDateString("es-PE", { weekday: "short" }).toUpperCase()
        : "—";
      const estado = r.estado || getEstadoAsistencia(r.entrada);
      return [
        i + 1,
        r.nombre,
        r.fecha || "—",
        dia,
        r.entrada,
        r.salida || "—",
        calcHoras(r.entrada, r.salida),
        estado,
        r.registrado_por || "—",
      ];
    });
    rows.push([]);
    rows.push(["--- RESUMEN POR TRABAJADOR ---", "", "", "", "", "", "", "", ""]);
    rows.push([
      "Trabajador",
      "Días registrados",
      "Días completos",
      "Tardanzas",
      "Total horas aprox.",
      "",
      "",
      "",
      "",
    ]);
    const trabajadoresMap = {};
    asistencias.forEach((r) => {
      if (!trabajadoresMap[r.nombre])
        trabajadoresMap[r.nombre] = { dias: 0, completos: 0, tardanzas: 0, minutos: 0 };
      trabajadoresMap[r.nombre].dias++;
      const estadoReg = r.estado || getEstadoAsistencia(r.entrada);
      if (estadoReg === "Tardanza") trabajadoresMap[r.nombre].tardanzas++;
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
      rows.push([nombre, stats.dias, stats.completos, stats.tardanzas, horas, "", "", "", ""]);
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