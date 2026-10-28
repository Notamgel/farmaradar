// Buscar: crea la búsqueda y lleva a su resultado en vivo.
const form = document.getElementById('form-buscar');
const error = document.getElementById('error');
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  error.hidden = true;
  const datos = Object.fromEntries(new FormData(form));
  if ((datos.medicamento || '').trim().length < 3) { error.textContent = 'Escribe el nombre de la medicina.'; error.hidden = false; return; }
  const boton = form.querySelector('[type=submit]');
  boton.disabled = true;
  boton.classList.add('girando');
  try {
    const r = await fetch('/api/busquedas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'No se pudo buscar. Intenta de nuevo.');
    location.href = `/b/${d.id}`;
  } catch (err) {
    error.textContent = err.message;
    error.hidden = false;
    boton.disabled = false;
    boton.classList.remove('girando');
  }
});
// Si llegó desde la landing con la medicina escrita, busca de una vez.
if (new URLSearchParams(location.search).get('m')) form.requestSubmit();
