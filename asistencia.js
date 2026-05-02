async function getMesesAsistencia() {
  const { data, error } = await supabaseClient
    .from("meses_asistencia")
    .select("*")
    .order("nombre", { ascending: true });
  if (error) { console.error(error); return []; }
  return data || [];
}

function getMesActivoAsistencia() {
  return document.getElementById("mesSelectorAsistencia").value;
}

async function renderSelectMesesAsistencia() {
  const sel = document.getElementById("mesSelectorAsistencia");
  const prev = sel.value;
  const meses = await getMesesAsistencia();
  sel.innerHTML = meses.length
    ? meses.map((m) => `<option value="${m.id}">${sanitize(m.nombre)}</option>`).join("")
    : '<option value="">— Sin meses —</option>';
  if (prev && meses.find((m) => m.id === prev)) sel.value = prev;
  else if (meses.length) sel.value = meses[meses.length - 1].id;
}

const overlayAsist = document.getElementById("modalAsistMesOverlay");
const inputMesAsist = document.getElementById("inputNuevoMesAsist");

document.getElementById("btnNuevoMesAsist").addEventListener("click", () => {
  inputMesAsist.value = "";
  document.getElementById("err-mes-asist").textContent = "";
  inputMesAsist.classList.remove("input-error");
  overlayAsist.classList.add("active");
  setTimeout(() => inputMesAsist.focus(), 80);
});

document.getElementById("modalAsistMesCancelar").addEventListener("click", () => overlayAsist.classList.remove("active"));
document.getElementById("modalAsistMesCerrar").addEventListener("click", () => overlayAsist.classList.remove("active"));
overlayAsist.addEventListener("click", (e) => {
  if (e.target === overlayAsist) overlayAsist.classList.remove("active");
});

document.getElementById("modalAsistMesConfirmar").addEventListener("click", async () => {
  const nombre = inputMesAsist.value.trim();
  const errEl = document.getElementById("err-mes-asist");
  inputMesAsist.classList.remove("input-error");
  errEl.textContent = "";
  if (!nombre || nombre.length < 2) {
    errEl.textContent = "Mínimo 2 caracteres.";
    inputMesAsist.classList.add("input-error");
    return;
  }
  const meses = await getMesesAsistencia();
  if (meses.find((m) => m.nombre.toLowerCase() === nombre.toLowerCase())) {
    errEl.textContent = "Ya existe un mes con ese nombre.";
    inputMesAsist.classList.add("input-error");
    return;
  }
  const nuevoMes = { id: uid(), nombre };
  const { error } = await supabaseClient.from("meses_asistencia").insert(nuevoMes);
  if (error) {
    console.error(error);
    mostrarToast("Error al crear el mes de asistencia.", "error");
    return;
  }
  await renderSelectMesesAsistencia();
  await renderSelectMesesDescargasAsistencia();
  document.getElementById("mesSelectorAsistencia").value = nuevoMes.id;
  await renderAsistencia();
  await audit("add", `Nuevo mes de asistencia creado: ${nombre}`);
  overlayAsist.classList.remove("active");
  mostrarToast(`✓ Mes de asistencia "${nombre}" creado.`, "success");
});

inputMesAsist?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("modalAsistMesConfirmar").click();
  if (e.key === "Escape") overlayAsist.classList.remove("active");
});

document.getElementById("mesSelectorAsistencia")?.addEventListener("change", async () => {
  await renderAsistencia();
  if (!isAdmin()) await renderColabAsistencia();
  if (isAdmin()) await renderSelectMesesDescargasAsistencia();
});

async function getAsistencias() {
  const mesId = getMesActivoAsistencia();
  if (mesId) {
    const { data, error } = await supabaseClient
      .from("asistencia")
      .select("*")
      .eq("mes_asist_id", mesId)
      .order("fecha", { ascending: true })
      .order("entrada", { ascending: true });
    if (error) { console.error(error); return []; }
    return data || [];
  }
  const hoy = getTodayStr();
  const { data, error } = await supabaseClient
    .from("asistencia")
    .select("*")
    .eq("fecha", hoy)
    .order("entrada", { ascending: true });
  if (error) { console.error(error); return []; }
  return data || [];
}

async function getAsistenciasHoy() {
  const mesId = getMesActivoAsistencia();
  const hoy = getTodayStr();
  let query = supabaseClient.from("asistencia").select("*").eq("fecha", hoy);
  if (mesId) query = query.eq("mes_asist_id", mesId);
  const { data, error } = await query.order("entrada", { ascending: true });
  if (error) { console.error(error); return []; }
  return data || [];
}

async function getRegistroColabHoy() {
  const s = getSession();
  const hoy = getTodayStr();
  const mesId = getMesActivoAsistencia();
  let query = supabaseClient.from("asistencia").select("*").eq("fecha", hoy).ilike("nombre", s.display);
  if (mesId) query = query.eq("mes_asist_id", mesId);
  const { data, error } = await query.limit(1);
  if (error) { console.error(error); return null; }
  return data && data.length ? data[0] : null;
}

async function renderColabAsistencia() {
  if (isAdmin()) return;
  const s = getSession();
  const statusEl = document.getElementById("colabAsistStatus");
  const btnEntrada = document.getElementById("btnColabEntrada");
  const btnSalida = document.getElementById("btnColabSalida");
  const registro = await getRegistroColabHoy();

  const headerNombre = document.getElementById("colabHeaderNombre");
  const headerFecha = document.getElementById("colabHeaderFecha");
  if (headerNombre) headerNombre.textContent = `Hola, ${s.display}`;
  if (headerFecha)
    headerFecha.textContent = new Date().toLocaleDateString("es-PE", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });

  if (!registro) {
    statusEl.className = "colab-asist-status colab-status--neutral";
    statusEl.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      Hola <strong>${sanitize(s.display)}</strong> — Aún no has registrado tu entrada hoy.`;
    btnEntrada.disabled = false;
    btnSalida.disabled = true;
    btnSalida.title = "Debes registrar tu entrada primero";
  } else if (registro.entrada && !registro.salida) {
    const estadoBadge = registro.estado === "Tardanza"
      ? `<span style="color:#ef4444;font-weight:700">⏰ Tardanza</span>`
      : `<span style="color:#059669;font-weight:700">✓ Asistencia</span>`;
    statusEl.className = "colab-asist-status colab-status--warn";
    statusEl.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
      Entrada registrada a las <strong>${sanitize(registro.entrada)}</strong> — Estado: ${estadoBadge}. Cuando termines, registra tu salida.`;
    btnEntrada.disabled = true;
    btnEntrada.title = "Ya registraste tu entrada hoy";
    btnSalida.disabled = false;
    btnSalida.title = "";
  } else if (registro.entrada && registro.salida) {
    statusEl.className = "colab-asist-status colab-status--ok";
    statusEl.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
      ¡Jornada completa! Entrada: <strong>${sanitize(registro.entrada)}</strong> · Salida: <strong>${sanitize(registro.salida)}</strong> · Total: <strong>${calcHoras(registro.entrada, registro.salida)}</strong>`;
    btnEntrada.disabled = true;
    btnSalida.disabled = true;
  }
}

// ── REGISTRO DE ENTRADA — COLABORADOR ──
document.getElementById("btnColabEntrada").addEventListener("click", async () => {
  if (isAdmin()) return;
  const s = getSession();
  const mesId = getMesActivoAsistencia();
  if (!mesId) {
    mostrarToast("No hay mes de asistencia activo. Contacta al administrador.", "error");
    return;
  }
  const existente = await getRegistroColabHoy();
  if (existente) {
    mostrarToast("Ya tienes una entrada registrada hoy.", "error");
    await renderColabAsistencia();
    return;
  }
  const hora = await mostrarColabHoraModal("entrada");
  if (!hora) return;

  // ── DETECCIÓN DE TARDANZA (10:21 en adelante) ──
  let justificacion = null;
  const estadoEntrada = getEstadoAsistencia(hora);
  if (estadoEntrada === "Tardanza") {
    // Usa la función de modals.js que tiene los IDs correctos del HTML
    justificacion = await mostrarJustificacionTardanzaModal(hora);
    if (!justificacion) {
      mostrarToast("Debes justificar la tardanza para continuar.", "error");
      return;
    }
  }

  const preview = `<strong>Trabajador:</strong> ${sanitize(s.display)}<br><strong>Acción:</strong> Entrada<br><strong>Hora:</strong> ${hora}<br><strong>Estado:</strong> ${estadoEntrada}<br><strong>Fecha:</strong> ${getTodayStr()}${
    justificacion ? `<br><strong>Justificación:</strong> ${sanitize(justificacion)}` : ""
  }`;
  const confirmado = await mostrarGuardar("¿Confirmar registro de entrada?", preview);
  if (!confirmado) return;

  const nuevo = {
    nombre: s.display,
    entrada: hora,
    salida: null,
    registrado_por: s.display,
    fecha: getTodayStr(),
    mes_asist_id: mesId,
    estado: estadoEntrada,
    justificacion: justificacion || null,
  };
  const { error } = await supabaseClient.from("asistencia").insert(nuevo);
  if (error) {
    console.error(error);
    mostrarToast("Error al registrar entrada.", "error");
    return;
  }
await audit("add", `Entrada registrada por colaborador: ${s.display} (${hora}) [${estadoEntrada}] — Mes: ${mesId}`);

  // ── WHATSAPP al admin si hay tardanza ──
  if (estadoEntrada === "Tardanza") {
    const fechaLegible = new Date().toLocaleDateString("es-PE", {
      weekday: "long", day: "numeric", month: "long", year: "numeric"
    });
    const waMsg = `⏰ *KRD Importaciones — TARDANZA*\n\n👤 Colaborador: ${s.display}\n📅 Fecha: ${fechaLegible}\n🕐 Hora de entrada: ${hora}\n\n📝 Justificación:\n${justificacion}`;
    await enviarWhatsApp(waMsg);
  }

  mostrarToast(
    `✓ Entrada registrada a las ${hora} — ${estadoEntrada}.`,
    estadoEntrada === "Asistencia" ? "success" : "error"
  );
  await mostrarEstadoEntradaModal(hora, s.display);
  await renderColabAsistencia();
  await renderAsistencia();
});

// ── REGISTRO DE SALIDA — COLABORADOR ──
document.getElementById("btnColabSalida").addEventListener("click", async () => {
  if (isAdmin()) return;
  const s = getSession();
  const registro = await getRegistroColabHoy();
  if (!registro) {
    mostrarToast("Primero debes registrar tu entrada.", "error");
    await renderColabAsistencia();
    return;
  }
  if (registro.salida) {
    mostrarToast("Tu salida ya fue registrada hoy.", "error");
    await renderColabAsistencia();
    return;
  }
  const hora = await mostrarColabHoraModal("salida");
  if (!hora) return;
  const [hE, mE] = registro.entrada.split(":").map(Number);
  const [hS, mS] = hora.split(":").map(Number);
  const minEntrada = hE * 60 + mE;
  const minSalida = hS * 60 + mS;
  const diff = minSalida >= minEntrada ? minSalida - minEntrada : 1440 - minEntrada + minSalida;
  if (diff === 0) {
    mostrarToast("La salida no puede ser igual a la entrada.", "error");
    return;
  }
  const preview = `<strong>Trabajador:</strong> ${sanitize(s.display)}<br><strong>Acción:</strong> Salida<br><strong>Hora salida:</strong> ${hora}<br><strong>Duración:</strong> ${calcHoras(registro.entrada, hora)}`;
  const confirmado = await mostrarGuardar("¿Confirmar registro de salida?", preview);
  if (!confirmado) return;
  const { error } = await supabaseClient.from("asistencia").update({ salida: hora }).eq("id", registro.id);
  if (error) {
    console.error(error);
    mostrarToast("Error al registrar salida.", "error");
    return;
  }
  await audit("add", `Salida registrada por colaborador: ${s.display} (${hora})`);
  mostrarToast(`✓ Salida registrada. Duración: ${calcHoras(registro.entrada, hora)}.`, "success");
  await renderColabAsistencia();
  await renderAsistencia();
});

// ── RENDER TABLA DE ASISTENCIAS ──
async function renderAsistencia() {
  const lista = await getAsistencias();
  const tbody = document.getElementById("bodyAsistencia");
  const empty = document.getElementById("emptyAsistencia");
  document.getElementById("totalAsistencias").textContent =
    `${lista.length} registro${lista.length !== 1 ? "s" : ""} en este mes`;
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
    <tr class="${i === lista.length - 1 ? "row-new" : ""}">
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

async function delAsistencia(id) {
  if (!isAdmin()) return;
  const confirmado = await mostrarConfirm("¿Eliminar registro?", "Se eliminará este registro de asistencia.", "Eliminar");
  if (!confirmado) return;
  const lista = await getAsistencias();
  const reg = lista.find((r) => r.id === id);
  const { error } = await supabaseClient.from("asistencia").delete().eq("id", id);
  if (error) {
    console.error(error);
    mostrarToast("Error al eliminar el registro.", "error");
    return;
  }
  await audit("delete", `Asistencia eliminada: ${reg?.nombre || id}`);
  await renderAsistencia();
  mostrarToast("Registro eliminado.", "info");
}

document.querySelectorAll('input[name="accionAsistencia"]').forEach((r) =>
  r.addEventListener("change", toggleAsistenciaMode)
);

function toggleAsistenciaMode() {
  if (!isAdmin()) return;
  const isEntrada = document.querySelector('input[name="accionAsistencia"]:checked').value === "entrada";
  document.getElementById("groupSelectSalida").style.display = isEntrada ? "none" : "block";
  document.getElementById("groupNombreTrabajador").style.display = isEntrada ? "block" : "none";
  document.getElementById("groupHoraEntrada").style.display = isEntrada ? "block" : "none";
  document.getElementById("groupHoraSalida").style.display = "block";
  const labelEntrada = document.getElementById("labelAccionEntrada");
  const labelSalida = document.getElementById("labelAccionSalida");
  if (labelEntrada) labelEntrada.style.opacity = isEntrada ? "1" : "0.7";
  if (labelSalida) labelSalida.style.opacity = isEntrada ? "0.7" : "1";
  if (!isEntrada) populateSelectSalida();
}

async function populateSelectSalida() {
  const select = document.getElementById("selectTrabajadorSalida");
  const lista = await getAsistenciasHoy();
  const filtered = lista.filter((r) => r.entrada && !r.salida);
  select.innerHTML = '<option value="">— Selecciona —</option>' +
    filtered.map((r) => `<option value="${r.id}">${sanitize(r.nombre)}</option>`).join("");
}

// ── FORMULARIO ADMIN — REGISTRAR ENTRADA / SALIDA ──
document.getElementById("formAsistencia").addEventListener("submit", async function (e) {
  e.preventDefault();
  if (!isAdmin()) {
    mostrarToast("Sin permisos para registrar asistencia.", "error");
    return;
  }
  const mesId = getMesActivoAsistencia();
  if (!mesId) {
    mostrarToast("Crea un mes de asistencia primero.", "error");
    return;
  }
  const accion = document.querySelector('input[name="accionAsistencia"]:checked').value;

  if (accion === "entrada") {
    const nom = document.getElementById("nombreTrabajador");
    const ent = document.getElementById("horaEntrada");
    const sal = document.getElementById("horaSalida");
    clearErrors(["err-nombre", "err-entrada", "err-salida"], [nom, ent, sal]);
    let ok = true;
    if (!nom.value.trim() || nom.value.trim().length < 3) { setError("err-nombre", nom, "Mínimo 3 caracteres."); ok = false; }
    if (!ent.value) { setError("err-entrada", ent, "Ingresa la hora de entrada."); ok = false; }
    if (sal.value && sal.value === ent.value) { setError("err-salida", sal, "Salida no puede ser igual a entrada."); ok = false; }
    if (!ok) return;

    const s = getSession();
    const hoy = getTodayStr();
    const lista = await getAsistenciasHoy();
    const yaExiste = lista.find((r) => r.nombre.toLowerCase() === nom.value.trim().toLowerCase());
    if (yaExiste) {
      mostrarToast(`Ya existe un registro para ${nom.value.trim()} hoy.`, "error");
      return;
    }

    // ── DETECCIÓN DE TARDANZA PARA ADMIN ──
    const estadoEntrada = getEstadoAsistencia(ent.value);
    let justificacionAdmin = null;
    if (estadoEntrada === "Tardanza") {
      // Usa la función de modals.js que tiene los IDs correctos del HTML
      justificacionAdmin = await mostrarJustificacionTardanzaModal(ent.value);
      if (!justificacionAdmin) {
        mostrarToast("Debes ingresar la justificación de tardanza.", "error");
        return;
      }
    }

    const preview = `<strong>Trabajador:</strong> ${sanitize(nom.value.trim())}<br><strong>Hora entrada:</strong> ${ent.value}${sal.value ? `<br><strong>Hora salida:</strong> ${sal.value}` : ""}<br><strong>Estado:</strong> ${estadoEntrada}${justificacionAdmin ? `<br><strong>Justificación:</strong> ${sanitize(justificacionAdmin)}` : ""}<br><strong>Fecha:</strong> ${hoy}<br><strong>Registrado por:</strong> ${sanitize(s?.display || "—")}`;
    const confirmado = await mostrarGuardar("¿Confirmar registro de entrada?", preview);
    if (!confirmado) return;

    const nuevo = {
      nombre: nom.value.trim(),
      entrada: ent.value,
      salida: sal.value || null,
      registrado_por: s?.display || "—",
      fecha: hoy,
      mes_asist_id: mesId,
      estado: estadoEntrada,
      justificacion: justificacionAdmin || null,
    };
    const { error } = await supabaseClient.from("asistencia").insert(nuevo);
    if (error) {
      console.error(error);
      mostrarToast("Error al guardar la asistencia.", "error");
      return;
    }
await audit("add", `Asistencia registrada (admin): ${nuevo.nombre} (${nuevo.entrada}–${nuevo.salida || "sin salida"}) [${estadoEntrada}]`);

  // ── WHATSAPP al admin si registra tardanza manualmente ──
  if (estadoEntrada === "Tardanza") {
    const fechaLegible = new Date().toLocaleDateString("es-PE", {
      weekday: "long", day: "numeric", month: "long", year: "numeric"
    });
    const waMsg = `⏰ *KRD Importaciones — TARDANZA REGISTRADA*\n\n👤 Trabajador: ${nuevo.nombre}\n📅 Fecha: ${fechaLegible}\n🕐 Hora de entrada: ${nuevo.entrada}\n👨‍💼 Registrado por: ${s?.display || "—"}\n\n📝 Justificación:\n${justificacionAdmin || "Sin justificación"}`;
    await enviarWhatsApp(waMsg);
  }

  await renderAsistencia();
    mostrarToast(`✓ Asistencia de ${nuevo.nombre} registrada — ${estadoEntrada}.`, "success");
    await mostrarEstadoEntradaModal(ent.value, nom.value.trim());
    this.reset();
    toggleAsistenciaMode();
  } else {
    const select = document.getElementById("selectTrabajadorSalida");
    const sal = document.getElementById("horaSalida");
    clearErrors(["err-select", "err-salida"], [select, sal]);
    let ok = true;
    if (!select.value) { setError("err-select", select, "Selecciona un trabajador."); ok = false; }
    if (!sal.value) { setError("err-salida", sal, "Ingresa la hora de salida."); ok = false; }
    if (!ok) return;
    const lista = await getAsistenciasHoy();
    const reg = lista.find((r) => r.id === select.value);
    if (!reg) { mostrarToast("Registro no encontrado.", "error"); return; }
    if (reg.salida) { mostrarToast("Este trabajador ya tiene salida registrada.", "error"); return; }
    if (sal.value === reg.entrada) { setError("err-salida", sal, "Salida no puede ser igual a entrada."); return; }
    const preview = `<strong>Trabajador:</strong> ${sanitize(reg.nombre)}<br><strong>Hora salida:</strong> ${sal.value}<br><strong>Duración:</strong> ${calcHoras(reg.entrada, sal.value)}`;
    const confirmado = await mostrarGuardar("¿Confirmar registro de salida?", preview);
    if (!confirmado) return;
    const { error } = await supabaseClient.from("asistencia").update({ salida: sal.value }).eq("id", select.value);
    if (error) {
      console.error(error);
      mostrarToast("Error al registrar la salida.", "error");
      return;
    }
    await audit("add", `Salida registrada (admin): ${reg.nombre} (${sal.value})`);
    await renderAsistencia();
    mostrarToast(`✓ Salida de ${reg.nombre} registrada.`, "success");
    this.reset();
    toggleAsistenciaMode();
  }
});

// ── LIMPIAR REGISTROS DEL MES ──
document.getElementById("clearAsistencia").addEventListener("click", async () => {
  if (!isAdmin()) return;
  const mesId = getMesActivoAsistencia();
  const meses = await getMesesAsistencia();
  const mes = meses.find((m) => m.id === mesId);
  const confirmado = await mostrarConfirm(
    `¿Limpiar registros del mes "${mes?.nombre || "actual"}"?`,
    "Se eliminarán TODOS los registros de asistencia de este mes.",
    "Limpiar todo",
  );
  if (!confirmado) return;
  let query = supabaseClient.from("asistencia").delete();
  if (mesId) query = query.eq("mes_asist_id", mesId);
  else query = query.eq("fecha", getTodayStr());
  const { error } = await query;
  if (error) {
    console.error(error);
    mostrarToast("Error al limpiar asistencias.", "error");
    return;
  }
  await audit("clear", `Registros de asistencia del mes "${mes?.nombre}" eliminados`);
  await renderAsistencia();
  mostrarToast("Registros del mes eliminados.", "info");
});