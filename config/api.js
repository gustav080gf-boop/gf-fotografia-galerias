window.GF_API_URL = 'https://script.google.com/macros/s/AKfycby439aU7A0nxKXK3vcZfA6rbuEdip7TfQaa2P2TqUy7k64GBSiatenxKGhOqPsir9U_gA/exec';

(() => {
  const apiBase = String(window.GF_API_URL || '');
  const nativeFetch = window.fetch.bind(window);

  window.fetch = function gfFetch(input, init = {}) {
    const rawUrl = typeof input === 'string' ? input : (input && input.url) || '';
    const method = String(init.method || 'GET').toUpperCase();

    if (!rawUrl.startsWith(apiBase) || method !== 'GET') {
      return nativeFetch(input, init);
    }

    return new Promise((resolve, reject) => {
      const callbackName = '__gf_jsonp_' + Date.now() + '_' + Math.random().toString(36).slice(2);
      const url = new URL(rawUrl);
      url.searchParams.set('callback', callbackName);

      const script = document.createElement('script');
      script.src = url.toString();
      script.async = true;

      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('La API tardó demasiado en responder.'));
      }, 30000);

      function cleanup() {
        clearTimeout(timer);
        if (script.parentNode) script.parentNode.removeChild(script);
        try { delete window[callbackName]; } catch (_) { window[callbackName] = undefined; }
      }

      window[callbackName] = (data) => {
        cleanup();
        resolve({
          ok: true,
          status: 200,
          json: async () => data
        });
      };

      script.onerror = () => {
        cleanup();
        reject(new Error('No se pudo cargar la respuesta de Apps Script.'));
      };

      document.head.appendChild(script);
    });
  };
})();
