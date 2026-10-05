(() => {
  const scriptUrl = new URL(document.currentScript.src, window.location.href);
  const baseHref = scriptUrl.href.replace(/assets\/js\/root-url\.js(?:[?#].*)?$/, '');
  const baseUrl = new URL(baseHref);
  const basePath = baseUrl.pathname.endsWith('/') ? baseUrl.pathname : `${baseUrl.pathname}/`;
  const routeMap = new Map([
    ['index.html', 'public/inicio.html'],
    ['public/', 'public/inicio.html'],
    ['public/inicio.html', 'public/inicio.html'],
    ['public/reservar.html', 'public/reservar.html'],
    ['public/gracias.html', 'public/gracias.html'],
    ['public/aura.html', 'public/aura.html'],
    ['public/disenios.html', 'public/disenios.html'],
    ['admin/', 'admin/index.html'],
    ['admin/index.html', 'admin/index.html'],
    ['admin/turnos.html', 'admin/turnos.html'],
    ['admin/clientes.html', 'admin/clientes.html'],
    ['admin/servicios.html', 'admin/servicios.html'],
    ['admin/historial.html', 'admin/historial.html'],
    ['admin/login.html', 'admin/login.html'],
    ['admin/tipos.html', 'admin/servicios.html']
  ]);
  const validRoutes = new Set(routeMap.values());
  const storageKey = 'aura-shell-route';

  function relativePath(pathname) {
    return pathname.startsWith(basePath) ? pathname.slice(basePath.length) : null;
  }

  function getRoute(pathname) {
    const path = relativePath(pathname);
    return path === null ? null : routeMap.get(path) || null;
  }

  function saveRoute(route) {
    if (!validRoutes.has(route)) return;
    try {
      window.sessionStorage.setItem(storageKey, route);
    } catch (error) {
      console.error('No se pudo guardar la página actual de Aura.', error);
    }
  }

  function readRoute() {
    try {
      const route = window.sessionStorage.getItem(storageKey);
      return validRoutes.has(route) ? route : null;
    } catch (error) {
      console.error('No se pudo recuperar la página actual de Aura.', error);
      return null;
    }
  }

  function start(frame, home) {
    frame.addEventListener('load', () => {
      if (frame.contentDocument.title) document.title = frame.contentDocument.title;
      const path = relativePath(frame.contentWindow.location.pathname);
      if (path && validRoutes.has(path)) saveRoute(path);
    });

    home.addEventListener('click', (event) => {
      const link = event.target.closest('a[target="aura-content"]');
      if (!link || link.origin !== baseUrl.origin) return;

      const route = getRoute(link.pathname);
      if (!route) return;
      home.hidden = true;
      frame.hidden = false;
    });

    const route = readRoute();
    if (route) {
      home.hidden = true;
      frame.hidden = false;
      frame.src = new URL(route, baseUrl).href;
    }
  }

  window.AURA_URL_SHELL = { start };

  const requestedRoute = getRoute(window.location.pathname);
  if (
    window.top === window.self &&
    requestedRoute &&
    window.location.protocol !== 'file:' &&
    relativePath(window.location.pathname) !== ''
  ) {
    saveRoute(requestedRoute);
    window.location.replace(baseUrl.href);
  }
})();
