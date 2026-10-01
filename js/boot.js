setTimeout(() => {
  const boot = document.querySelector('.boot');
  if (!boot) return;
  const retry = document.createElement('button');
  retry.className = 'btn btn--primary';
  retry.type = 'button';
  retry.textContent = 'Reintentar';
  retry.addEventListener('click', () => location.reload());
  boot.replaceChildren('No se pudo cargar la app. Revisa tu conexión a internet.', retry);
}, 12000);
