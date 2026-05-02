// theme.js — Modo claro/oscuro KRD Importaciones

(function () {
  const KEY = "krd_theme";
  const saved = localStorage.getItem(KEY);
  if (saved === "light") document.body.classList.add("light-mode");

  document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("btnThemeToggle");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const isLight = document.body.classList.toggle("light-mode");
      localStorage.setItem(KEY, isLight ? "light" : "dark");
    });
  });
})();
