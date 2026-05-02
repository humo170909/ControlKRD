// cambiarpass.js — Cambio de contraseña para colaboradores y admin

document.getElementById("btnCambiarPass")?.addEventListener("click", () => {
  const overlay = document.getElementById("modalCambiarPassOverlay");
  document.getElementById("passActual").value = "";
  document.getElementById("passNueva").value = "";
  document.getElementById("passConfirmar").value = "";
  document.getElementById("err-pass-actual").textContent = "";
  document.getElementById("err-pass-nueva").textContent = "";
  document.getElementById("err-pass-confirmar").textContent = "";
  overlay.classList.add("active");
  setTimeout(() => document.getElementById("passActual").focus(), 80);
});

document.getElementById("modalCambiarPassCerrar")?.addEventListener("click", () => {
  document.getElementById("modalCambiarPassOverlay").classList.remove("active");
});

document.getElementById("modalCambiarPassCancelar")?.addEventListener("click", () => {
  document.getElementById("modalCambiarPassOverlay").classList.remove("active");
});

document.getElementById("formCambiarPass")?.addEventListener("submit", async function (e) {
  e.preventDefault();

  const passActual    = document.getElementById("passActual").value;
  const passNueva     = document.getElementById("passNueva").value;
  const passConfirmar = document.getElementById("passConfirmar").value;
  const errActual     = document.getElementById("err-pass-actual");
  const errNueva      = document.getElementById("err-pass-nueva");
  const errConfirmar  = document.getElementById("err-pass-confirmar");
  const btnGuardar    = document.getElementById("btnGuardarPass");

  // Limpiar errores
  errActual.textContent = "";
  errNueva.textContent = "";
  errConfirmar.textContent = "";

  // Validaciones
  let ok = true;
  if (!passActual) { errActual.textContent = "Ingresa tu contraseña actual."; ok = false; }
  if (!passNueva || passNueva.length < 6) { errNueva.textContent = "Mínimo 6 caracteres."; ok = false; }
  if (passNueva !== passConfirmar) { errConfirmar.textContent = "Las contraseñas no coinciden."; ok = false; }
  if (passActual === passNueva) { errNueva.textContent = "La nueva contraseña debe ser diferente a la actual."; ok = false; }
  if (!ok) return;

  btnGuardar.disabled = true;
  btnGuardar.textContent = "Guardando...";

  try {
    const s = getSession();

    // 1. Verificar contraseña actual
    const { error: authErr } = await supabaseClient.auth.signInWithPassword({
      email: s.email,
      password: passActual,
    });
    if (authErr) {
      errActual.textContent = "Contraseña actual incorrecta.";
      return;
    }

    // 2. Actualizar a la nueva contraseña
    const { error: updateErr } = await supabaseClient.auth.updateUser({
      password: passNueva,
    });
    if (updateErr) {
      errNueva.textContent = "Error al actualizar: " + updateErr.message;
      return;
    }

    // 3. Guardar en tabla perfiles la fecha del cambio
    const { error: perfilErr } = await supabaseClient
      .from("perfiles")
      .update({
        ultimo_cambio_pass: new Date().toISOString(),
        pass_cambiada_por: s.display,
      })
      .eq("username", s.username);

    if (perfilErr) console.error("Error guardando fecha cambio pass:", perfilErr);

    // 4. Registrar en auditoría
    await audit("add", `Contraseña cambiada por: ${s.display}`);

    document.getElementById("modalCambiarPassOverlay").classList.remove("active");
    mostrarToast("✓ Contraseña actualizada correctamente.", "success");

  } catch (err) {
    console.error(err);
    mostrarToast("Error inesperado. Intenta de nuevo.", "error");
  } finally {
    btnGuardar.disabled = false;
    btnGuardar.textContent = "Guardar nueva contraseña";
  }
});