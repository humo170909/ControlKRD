async function enviarWhatsApp(mensaje) {
  try {
    const texto = encodeURIComponent(mensaje);
    const url = `https://api.callmebot.com/whatsapp.php?phone=${WA_PHONE}&text=${texto}&apikey=${WA_APIKEY}`;
    const resp = await fetch(url, { method: "GET", mode: "no-cors" });
    return true;
  } catch (err) {
    console.warn("WhatsApp send error (non-critical):", err);
    return false;
  }
}

async function actualizarBadgeObs() {
  if (!isAdmin()) return;
  const { count, error } = await supabaseClient
    .from("observaciones_mercaderia")
    .select("id", { count: "exact", head: true })
    .eq("leida_admin", false);
  const badge = document.getElementById("obsBadge");
  if (!badge) return;
  if (!error && count > 0) {
    badge.textContent = count > 99 ? "99+" : count;
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }
}

async function renderObservaciones() {
  const s = getSession();
  const tbody = document.getElementById("bodyObservaciones");
  const empty = document.getElementById("emptyObservaciones");
  const meta = document.getElementById("totalObservaciones");

  let query = supabaseClient
    .from("observaciones_mercaderia")
    .select("*")
    .order("fecha", { ascending: false })
    .limit(200);

  if (!isAdmin()) {
    query = query.eq("usuario", s.username);
  }

  const { data, error } = await query;
  if (error) {
    console.error(error);
    mostrarToast("Error al cargar observaciones.", "error");
    return;
  }

  const lista = data || [];
  meta.textContent = `${lista.length} observación${lista.length !== 1 ? "es" : ""}`;

  if (!lista.length) {
    tbody.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  tbody.innerHTML = lista
    .map((obs, i) => {
      const fecha = new Date(obs.fecha).toLocaleString("es-PE");
      const leida = obs.leida_admin;
      const badge = leida
        ? `<span class="obs-status-badge obs-status-badge--leida">✓ Leída</span>`
        : `<span class="obs-status-badge obs-status-badge--nueva">● Nueva</span>`;
      const accionAdmin =
        isAdmin() && !leida
          ? `<button class="btn-mark-leida" onclick="marcarObsLeida('${obs.id}')">Marcar leída</button>`
          : "";
      const eliminarBtn = isAdmin()
        ? `<button class="btn-delete" title="Eliminar observación" onclick="eliminarObservacion('${obs.id}')">✕</button>`
        : "";
      return `
      <tr class="${!leida ? "obs-row--nueva row-new" : ""}">
        <td>${i + 1}</td>
        <td class="val-mono" style="font-size:0.75rem;white-space:nowrap">${sanitize(fecha)}</td>
        ${isAdmin() ? `<td><span class="reg-by">${sanitize(obs.usuario)}</span></td>` : ""}
        <td class="obs-msg-text">${sanitize(obs.mensaje)}</td>
        <td>${badge}</td>
        ${isAdmin() ? `<td style="display:flex;gap:6px;align-items:center">${accionAdmin}${eliminarBtn}</td>` : ""}
      </tr>`;
    })
    .join("");

  if (isAdmin()) await actualizarBadgeObs();
}

async function eliminarObservacion(id) {
  if (!isAdmin()) return;
  const confirmado = await mostrarEliminarObsModal();
  if (!confirmado) return;
  const { error } = await supabaseClient
    .from("observaciones_mercaderia")
    .delete()
    .eq("id", id);
  if (error) {
    console.error(error);
    mostrarToast("Error al eliminar la observación.", "error");
    return;
  }
  await audit("delete", `Observación eliminada: ID ${id}`);
  await renderObservaciones();
  mostrarToast("Observación eliminada.", "info");
}

async function marcarObsLeida(id) {
  if (!isAdmin()) return;
  const { error } = await supabaseClient
    .from("observaciones_mercaderia")
    .update({ leida_admin: true })
    .eq("id", id);
  if (error) {
    console.error(error);
    mostrarToast("Error al marcar como leída.", "error");
    return;
  }
  await renderObservaciones();
  mostrarToast("Observación marcada como leída.", "success");
}

document
  .getElementById("btnMarcarTodasLeidas")
  .addEventListener("click", async () => {
    if (!isAdmin()) return;
    const confirmado = await mostrarConfirm(
      "¿Marcar todas como leídas?",
      "Se marcarán todas las observaciones pendientes como leídas.",
      "Confirmar",
    );
    if (!confirmado) return;
    const { error } = await supabaseClient
      .from("observaciones_mercaderia")
      .update({ leida_admin: true })
      .eq("leida_admin", false);
    if (error) {
      console.error(error);
      mostrarToast("Error al actualizar.", "error");
      return;
    }
    await renderObservaciones();
    mostrarToast("✓ Todas las observaciones marcadas como leídas.", "success");
  });

document.getElementById("obsTexto").addEventListener("input", function () {
  const len = this.value.length;
  const count = document.getElementById("obsCharCount");
  count.textContent = `${len} / 1000`;
  count.className =
    "obs-count" +
    (len > 900 ? " obs-count--limit" : len > 700 ? " obs-count--warn" : "");
});

document
  .getElementById("formObservacion")
  .addEventListener("submit", async function (e) {
    e.preventDefault();
    const s = getSession();
    const textarea = document.getElementById("obsTexto");
    const errEl = document.getElementById("err-obs");
    const btn = document.getElementById("btnEnviarObs");

    errEl.textContent = "";
    textarea.classList.remove("input-error");

    const texto = textarea.value.trim();

    if (!texto || texto.length < 5) {
      errEl.textContent = "El mensaje debe tener al menos 5 caracteres.";
      textarea.classList.add("input-error");
      return;
    }
    if (texto.length > 1000) {
      errEl.textContent = "El mensaje no puede superar los 1000 caracteres.";
      textarea.classList.add("input-error");
      return;
    }

    btn.disabled = true;
    btn.innerHTML = `<span class="obs-sending-spinner"></span> Enviando...`;

    try {
      const ahora = new Date().toISOString();
      const obs = {
        fecha: ahora,
        fecha_registro: ahora,
        usuario: s.username,
        username: s.username,
        colaborador: s.display,
        user_email: s.email,
        rol: s.role,
        asunto: "Observación de mercadería",
        detalle: texto,
        mensaje: texto,
        leida_admin: false,
        notificado_whatsapp: false,
        notificado_en: null,
        ip_origen: null,
        mes_asist_id: null,
      };
      const { error } = await supabaseClient
        .from("observaciones_mercaderia")
        .insert(obs);
      if (error) {
        console.error(
          "Supabase error detalle:",
          error.code,
          error.message,
          error.details,
          error.hint,
        );
        throw error;
      }

      const fechaLegible = new Date().toLocaleString("es-PE");
      const waMsg = `📦 *KRD Importaciones - Nueva Observación*\n\n👤 Colaborador: ${s.display}\n📅 Fecha: ${fechaLegible}\n\n💬 Mensaje:\n${texto}`;
      await enviarWhatsApp(waMsg);

      await audit("add", `Observación enviada por: ${s.display}`);

      textarea.value = "";
      document.getElementById("obsCharCount").textContent = "0 / 1000";
      document.getElementById("obsCharCount").className = "obs-count";

      await mostrarObsConfirm(texto, s.display);
      await renderObservaciones();
    } catch (err) {
      console.error("Error al enviar observación:", err);
      mostrarToast(
        "Error al enviar la observación. Intenta de nuevo.",
        "error",
      );
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Enviar Observación`;
    }
  });
