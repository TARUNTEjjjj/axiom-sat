(() => {
  const projectPath = '/axiom-sat';
  const path = location.pathname.startsWith(projectPath + '/')
    ? location.pathname.slice(projectPath.length + 1)
    : '';
  const destination = new URL('https://axiom-sat.pages.dev/');
  // Assign only the pathname; strip leading slash-like escapes so no route can become an authority.
  destination.pathname = '/' + path.replace(/^(?:[/\\]|%(?:25)*(?:2f|5c))+/i, '');
  destination.pathname = destination.pathname.replace(/^\/{2,}/, '/');
  destination.search = location.search;
  destination.hash = location.hash;
  location.replace(destination.href);
})();
