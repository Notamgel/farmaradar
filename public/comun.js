// Menú del teléfono y botones de copiar.
document.addEventListener('click', (e) => {
  const alt = e.target.closest('[data-alternar]');
  if (alt) {
    const el = document.getElementById(alt.dataset.alternar);
    if (el) { const abierto = el.classList.toggle('abierto'); alt.setAttribute('aria-expanded', String(abierto)); }
  }
  const cop = e.target.closest('[data-copiar-de]');
  if (cop) {
    const campo = cop.parentElement.querySelector(cop.dataset.copiarDe) || document.querySelector(cop.dataset.copiarDe);
    if (!campo) return;
    const hecho = () => { const t = cop.textContent; cop.textContent = 'Copiado'; setTimeout(() => { cop.textContent = t; }, 1600); };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(campo.value).then(hecho, () => { campo.select(); document.execCommand('copy'); hecho(); });
    else { campo.select(); document.execCommand('copy'); hecho(); }
  }
});

// Formularios que piden confirmación antes de enviarse.
document.addEventListener('submit', (e) => {
  const msg = e.target.closest('form')?.dataset.confirma;
  if (msg && !confirm(msg)) e.preventDefault();
});
