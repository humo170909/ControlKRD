// auth.js — Autenticación y control de sesión KRD Importaciones

async function mostrarApp(session) {
  document.getElementById("loginScreen").classList.add("hidden");
  document.getElementById("appScreen").classList.remove("hidden");

  document.getElementById("userBadgeName").textContent = session.display;
  const roleTag = document.getElementById("userRoleTag");
  roleTag.textContent = session.role === "admin" ? "Admin" : "Colaborador";
  roleTag.className = `role-tag ${session.role === "employee" ? "role-employee" : ""}`;

  document
    .querySelectorAll(".tab-admin-only")
    .forEach((el) => el.classList.toggle("hidden", !isAdmin()));
  document
    .querySelectorAll(".admin-only")
    .forEach((el) => el.classList.toggle("hidden", !isAdmin()));
  document
    .querySelectorAll(".colab-only")
    .forEach((el) => el.classList.toggle("hidden", isAdmin()));

  document.getElementById("headerDate").textContent =
    new Date().toLocaleDateString("es-PE", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  iniciarRelojPeru();

  if (isAdmin()) {
    document.getElementById("asistAdminView").classList.remove("hidden");
    document.getElementById("formAsistencia").classList.remove("hidden");
    document.getElementById("asistColabView").classList.add("hidden");
    document.getElementById("cardTablaAsistencia").classList.remove("hidden");
    document.getElementById("cardTablaVentas").classList.remove("hidden");
    document.getElementById("reporteGrid").classList.remove("hidden");
    document.getElementById("cardColabVentasMsg").classList.add("hidden");

    activarTab("asistencia");
    await renderSelectMesesAsistencia();
    await renderAsistencia();
    toggleAsistenciaMode();
    await renderSelectMesesDescargas();
    await renderSelectMesesDescargasAsistencia();
    await actualizarBadgeObs();
  } else {
    document.getElementById("asistAdminView").classList.add("hidden");
    document.getElementById("formAsistencia").classList.add("hidden");
    document.getElementById("asistColabView").classList.remove("hidden");
    document.getElementById("cardTablaAsistencia").classList.remove("hidden");
    document.getElementById("cardTablaVentas").classList.add("hidden");
    document.getElementById("reporteGrid").classList.add("hidden");
    document.getElementById("cardColabVentasMsg").classList.add("hidden");

    activarTab("asistencia");
    await renderSelectMesesAsistencia();
    await renderColabAsistencia();
    await renderAsistencia();
  }

  await renderVentas();
  await renderSelectMeses();

  const obsLabel = document.getElementById("obsTableLabel");
  if (obsLabel)
    obsLabel.textContent = isAdmin()
      ? "TODAS LAS OBSERVACIONES"
      : "MIS OBSERVACIONES";
}

function mostrarLogin() {
  document.getElementById("loginScreen").classList.remove("hidden");
  document.getElementById("appScreen").classList.add("hidden");
}

function activarTab(nombre) {
  document
    .querySelectorAll(".tab-btn")
    .forEach((b) => b.classList.toggle("active", b.dataset.tab === nombre));
  document
    .querySelectorAll(".tab-panel")
    .forEach((p) => p.classList.toggle("active", p.id === "tab-" + nombre));
}

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const tab = btn.dataset.tab;
    activarTab(tab);
    if (tab === "auditoria")     await renderAuditoria();
    if (tab === "observaciones") await renderObservaciones();
    if (tab === "usuarios")      await renderTablaUsuarios();
  });
});

/* ── Formulario de Login ── */
document
  .getElementById("formLogin")
  .addEventListener("submit", async function (e) {
    e.preventDefault();

    // Deshabilitar botón para prevenir doble submit
    const submitBtn = this.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    const userInput = document.getElementById("loginUser");
    const passInput = document.getElementById("loginPass");
    const errorBox  = document.getElementById("loginErrorBox");

    clearErrors(["err-loginUser", "err-loginPass"], [userInput, passInput]);
    errorBox.classList.remove("show");

    if (isLoginBlocked()) {
      const secs = getBlockSecondsLeft();
      errorBox.textContent = `Demasiados intentos fallidos. Espera ${secs} segundos.`;
      errorBox.classList.add("show");
      if (submitBtn) submitBtn.disabled = false;
      return;
    }

    const user = userInput.value.trim();
    const pass = passInput.value;

    if (!user) {
      setError("err-loginUser", userInput, "Ingresa tu usuario.");
      if (submitBtn) submitBtn.disabled = false;
      return;
    }
    if (!pass) {
      setError("err-loginPass", passInput, "Ingresa tu contraseña.");
      if (submitBtn) submitBtn.disabled = false;
      return;
    }

    try {
      const { data: perfil, error: perfilErr } = await supabaseClient
        .from("perfiles")
        .select("email, username, display_name, rol")
        .ilike("username", user)
        .single();

      if (perfilErr || !perfil) {
        const fails = incrementLoginFails();
        if (fails >= MAX_LOGIN_TRIES) {
          blockLogin();
          errorBox.textContent = `Cuenta bloqueada por ${BLOCK_MS / 60000} minutos por exceso de intentos.`;
        } else {
          errorBox.textContent = `Usuario o contraseña incorrectos. Intentos restantes: ${MAX_LOGIN_TRIES - fails}`;
        }
        errorBox.classList.add("show");
        return;
      }

      const { data: authData, error: authErr } =
        await supabaseClient.auth.signInWithPassword({
          email: perfil.email,
          password: pass,
        });

      if (authErr || !authData?.user) {
        const fails = incrementLoginFails();
        if (fails >= MAX_LOGIN_TRIES) {
          blockLogin();
          errorBox.textContent = `Cuenta bloqueada por ${BLOCK_MS / 60000} minutos.`;
        } else {
          errorBox.textContent = `Contraseña incorrecta. Intentos restantes: ${MAX_LOGIN_TRIES - fails}`;
        }
        errorBox.classList.add("show");
        return;
      }

      resetLoginFails();
      const session = {
        uid:     authData.user.id,
        email:   perfil.email,
        username: perfil.username,
        display: perfil.display_name || perfil.username,
        role:    perfil.rol,
      };
      setSession(session);
      await audit("login", `Inicio de sesión: ${session.display} [${session.role}]`);
      await mostrarApp(session);

    } catch (err) {
      console.error("Error inesperado en login:", err);
      errorBox.textContent = "Error de conexión. Intenta de nuevo.";
      errorBox.classList.add("show");
    } finally {
      // CORRECCIÓN: siempre re-habilitar el botón al terminar
      if (submitBtn) submitBtn.disabled = false;
    }
  });

/* ── Toggle mostrar/ocultar contraseña ── */
document.getElementById("togglePass").addEventListener("click", () => {
  const inp = document.getElementById("loginPass");
  inp.type = inp.type === "password" ? "text" : "password";
});

/* ── Detectar formularios con datos sin guardar ── */
function _tieneDatosSinGuardar() {
  const campos = [
    "obsTexto",
    "nombreTrabajador",
    "horaEntrada",
    "ventaEfectivo",
    "ventaYape",
    "ventaPlin",
    "gananciaDelDia",
  ];
  return campos.some((id) => {
    const el = document.getElementById(id);
    return el && (el.value || "").trim().length > 0;
  });
}

/* ── Cerrar sesión ── */
document.getElementById("btnLogout").addEventListener("click", async () => {
  const appVisible = !document.getElementById("appScreen").classList.contains("hidden");
  if (appVisible && _tieneDatosSinGuardar()) {
    const confirmar = await mostrarConfirm(
      "¿Cerrar sesión?",
      "Tienes campos con datos sin guardar. Si cierras sesión se perderán.",
      "Cerrar igual"
    );
    if (!confirmar) return;
  }
  const s = getSession();
  if (s) await audit("logout", `Cierre de sesión: ${s.display}`);
  clearSession();
  await supabaseClient.auth.signOut();
  location.reload();
});
