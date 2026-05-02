// ══════════════════════════════════════════════
// GESTIÓN DE USUARIOS — KRD Importaciones
// Admin puede crear, editar y desactivar
// colaboradores sin ir a Supabase
// ══════════════════════════════════════════════

// ─── CARGA Y RENDER DE TABLA DE USUARIOS ──────

async function getUsuarios() {
  const { data, error } = await supabaseClient.from("perfiles").select("*")
    .order("display_name", { ascending: true });
  if (error) { console.error(error); return []; }
  return data || [];
}

async function renderTablaUsuarios() {
  if (!isAdmin()) return;
  const tbody = document.getElementById("bodyUsuarios");
  const empty = document.getElementById("emptyUsuarios");
  if (!tbody) return;

  const lista = await getUsuarios();

  const total     = lista.length;
  const activos   = lista.filter((u) => u.activo !== false).length;
  const inactivos = total - activos;
  const admins    = lista.filter((u) => u.rol === "admin").length;
  const setCard   = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setCard("totalUsuariosCount", total);
  setCard("totalActivosCount",  activos);
  setCard("totalInactivosCount", inactivos);
  setCard("totalAdminsCount",   admins);

  if (!lista.length) {
    tbody.innerHTML = "";
    if (empty) empty.classList.remove("hidden");
    return;
  }
  if (empty) empty.classList.add("hidden");

  tbody.innerHTML = lista.map((u, i) => {
    const activo = u.activo !== false; // por defecto activo si no existe el campo
    const rolBadge = u.rol === "admin"
      ? `<span style="background:rgba(123,94,248,0.2);color:#a48dff;padding:2px 10px;border-radius:999px;font-size:0.72rem;font-weight:600">Admin</span>`
      : `<span style="background:rgba(77,166,255,0.12);color:#4da6ff;padding:2px 10px;border-radius:999px;font-size:0.72rem;font-weight:600">Colaborador</span>`;
    const activoBadge = activo
      ? `<span style="background:rgba(78,203,141,0.15);color:#4ecb8d;padding:2px 8px;border-radius:999px;font-size:0.72rem">● Activo</span>`
      : `<span style="background:rgba(240,90,110,0.12);color:#f05a6e;padding:2px 8px;border-radius:999px;font-size:0.72rem">○ Inactivo</span>`;

    return `
      <tr>
        <td>${i + 1}</td>
        <td style="font-weight:600">${sanitize(u.display_name || u.nombre || "—")}</td>
        <td><code style="font-size:0.78rem;color:var(--text-secondary)">${sanitize(u.username || u.usuario || "—")}</code></td>
        <td>${rolBadge}</td>
        <td>${activoBadge}</td>
        <td style="color:var(--text-muted);font-size:0.78rem">${u.creado_en ? new Date(u.creado_en).toLocaleDateString("es-PE") : "—"}</td>
        <td>
          <div style="display:flex;gap:6px;align-items:center">
            <button class="btn btn-sm btn-ghost" onclick="abrirModalEditarUsuario('${u.id}')"
              style="font-size:0.72rem;padding:4px 10px">
              ✏️ Editar
            </button>
            <button class="btn btn-sm ${activo ? "btn-danger" : "btn-ghost"}"
              onclick="toggleActivoUsuario('${u.id}', ${activo})"
              style="font-size:0.72rem;padding:4px 10px">
              ${activo ? "🚫 Desactivar" : "✅ Activar"}
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

// ─── MODAL CREAR USUARIO ──────────────────────

function abrirModalCrearUsuario() {
  if (!isAdmin()) return;
  const overlay = document.getElementById("modalGestionUsuariosOverlay");
  if (!overlay) return;
  document.getElementById("gestionUserTitle").textContent = "➕ Nuevo colaborador";
  document.getElementById("gestionUserId").value = "";
  document.getElementById("gestionUserNombre").value = "";
  document.getElementById("gestionUserUsuario").value = "";
  document.getElementById("gestionUserRol").value = "colaborador";
  limpiarErroresGestion();
  overlay.classList.add("active");
  setTimeout(() => document.getElementById("gestionUserNombre").focus(), 80);
}

// ─── MODAL EDITAR USUARIO ─────────────────────

async function abrirModalEditarUsuario(id) {
  if (!isAdmin()) return;
  const overlay = document.getElementById("modalGestionUsuariosOverlay");
  if (!overlay) return;

  const lista = await getUsuarios();
  const u = lista.find((x) => x.id === id);
  if (!u) { mostrarToast("Usuario no encontrado.", "error"); return; }

  document.getElementById("gestionUserTitle").textContent = "✏️ Editar colaborador";
  document.getElementById("gestionUserId").value = u.id;
  document.getElementById("gestionUserNombre").value = u.display_name || u.nombre || "";
  document.getElementById("gestionUserUsuario").value = u.username || u.usuario || "";
  document.getElementById("gestionUserRol").value = u.rol || "colaborador";
  limpiarErroresGestion();
  overlay.classList.add("active");
  setTimeout(() => document.getElementById("gestionUserNombre").focus(), 80);
}

function limpiarErroresGestion() {
  ["err-gestion-nombre", "err-gestion-usuario"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = "";
  });
  ["gestionUserNombre", "gestionUserUsuario"].forEach((id) => {
    document.getElementById(id)?.classList.remove("input-error");
  });
}

// ─── GUARDAR (crear o editar) ─────────────────

document.addEventListener("DOMContentLoaded", () => {
  const overlay = document.getElementById("modalGestionUsuariosOverlay");
  if (!overlay) return;

  document.getElementById("gestionUserCerrar")?.addEventListener("click", () => overlay.classList.remove("active"));
  document.getElementById("gestionUserCancelar")?.addEventListener("click", () => overlay.classList.remove("active"));
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.classList.remove("active"); });

  document.getElementById("gestionUserGuardar")?.addEventListener("click", async () => {
    const id      = document.getElementById("gestionUserId").value.trim();
    const nombre  = document.getElementById("gestionUserNombre").value.trim();
    const usuario = document.getElementById("gestionUserUsuario").value.trim().toLowerCase();
    const rol     = document.getElementById("gestionUserRol").value;

    limpiarErroresGestion();
    let ok = true;

    if (!nombre || nombre.length < 2) {
      document.getElementById("err-gestion-nombre").textContent = "Mínimo 2 caracteres.";
      document.getElementById("gestionUserNombre").classList.add("input-error");
      ok = false;
    }
    if (!usuario || usuario.length < 2) {
      document.getElementById("err-gestion-usuario").textContent = "Mínimo 2 caracteres.";
      document.getElementById("gestionUserUsuario").classList.add("input-error");
      ok = false;
    }
    if (!ok) return;

    const todos = await getUsuarios();
    const duplicado = todos.find((u) =>
      (u.username || u.usuario || "").toLowerCase() === usuario && u.id !== id
    );
    if (duplicado) {
      document.getElementById("err-gestion-usuario").textContent = "Ese usuario ya existe.";
      document.getElementById("gestionUserUsuario").classList.add("input-error");
      return;
    }

    try {
      if (id) {
        const { error } = await supabaseClient
          .from("perfiles")
          .update({ display_name: nombre, username: usuario, rol })
          .eq("id", id);
        if (error) throw error;
        await audit("edit", `Usuario editado: ${nombre} (${usuario})`);
        mostrarToast(`✓ Colaborador "${nombre}" actualizado.`, "success");
      } else {
        const nuevo = { id: uid(), display_name: nombre, username: usuario, rol, activo: true };
        const { error } = await supabaseClient.from("perfiles").insert(nuevo);
        if (error) throw error;
        await audit("add", `Nuevo usuario creado: ${nombre} (${usuario}) — Rol: ${rol}`);
        mostrarToast(`✓ Colaborador "${nombre}" creado exitosamente.`, "success");
      }
      overlay.classList.remove("active");
      await renderTablaUsuarios();
    } catch (err) {
      console.error(err);
      mostrarToast("Error al guardar el usuario.", "error");
    }
  });
});

// ─── ACTIVAR / DESACTIVAR ─────────────────────

async function toggleActivoUsuario(id, estaActivo) {
  if (!isAdmin()) return;
  const accion = estaActivo ? "desactivar" : "activar";
  const confirmado = await mostrarConfirm(
    `¿${estaActivo ? "Desactivar" : "Activar"} colaborador?`,
    estaActivo
      ? "El colaborador no podrá iniciar sesión hasta que lo reactives."
      : "El colaborador podrá volver a iniciar sesión.",
    estaActivo ? "Desactivar" : "Activar"
  );
  if (!confirmado) return;

  const { error } = await supabaseClient
    .from("perfiles")
    .update({ activo: !estaActivo })
    .eq("id", id);

  if (error) {
    console.error(error);
    mostrarToast("Error al actualizar el estado.", "error");
    return;
  }

  await audit("edit", `Usuario ${accion}do: ID ${id}`);
  mostrarToast(`✓ Colaborador ${accion}do correctamente.`, "success");
  await renderTablaUsuarios();
}