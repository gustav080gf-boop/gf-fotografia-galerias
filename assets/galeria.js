(() => {
  const qs = new URLSearchParams(location.search);
  const slug = (qs.get('g') || '').trim().toLowerCase();
  const API = String(window.GF_API_URL || '').trim();
  const el = id => document.getElementById(id);

  const lockScreen = el('lockScreen');
  const galleryApp = el('galleryApp');
  const pinInput = el('pinInput');
  const accessBtn = el('accessBtn');
  const accessError = el('accessError');
  const lockTitle = el('lockTitle');
  const lockMessage = el('lockMessage');
  const galleryTitle = el('galleryTitle');
  const gallerySubtitle = el('gallerySubtitle');
  const grid = el('photoGrid');
  const downloadAllBtn = el('downloadAllBtn');
  const sendPrintBtn = el('sendPrintBtn');
  const selectedCount = el('selectedCount');
  const selectedCountTop = el('selectedCountTop');
  const clearSelectionBtn = el('clearSelectionBtn');
  const protectionNotice = el('protectionNotice');
  const lightbox = el('lightbox');
  const lightboxImg = el('lightboxImg');
  const lightboxClose = el('lightboxClose');

  let gallery = null;
  let token = sessionStorage.getItem(`gf-token:${slug}`) || '';
  let photos = [];
  const selected = new Set();
  const loadingPreviews = new Set();

  init();

  async function init() {
    if (!API || API.includes('REEMPLAZAR_')) return fatal('La API todavía no está configurada.');
    if (!slug) return fatal('Falta identificar la galería.');

    try {
      const data = await apiGet('gallery', { g: slug }, 15000);
      if (!data.ok) return fatal(data.error || 'Galería no disponible.');
      gallery = data.gallery;
      lockTitle.textContent = gallery.title || 'Acceso';

      if (token) {
        try {
          await openGallery();
          return;
        } catch (_) {
          sessionStorage.removeItem(`gf-token:${slug}`);
          token = '';
        }
      }
    } catch (err) {
      return fatal(`No se pudo conectar con la galería. ${friendlyError(err)}`);
    }

    pinInput.addEventListener('input', () => {
      pinInput.value = pinInput.value.replace(/\D/g, '').slice(0, 4);
    });
    pinInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') verifyAccess();
    });
    accessBtn.addEventListener('click', verifyAccess);
  }

  function fatal(message) {
    lockTitle.textContent = 'Galería no disponible';
    if (lockMessage) lockMessage.textContent = message;
    pinInput.hidden = true;
    accessBtn.hidden = true;
  }

  async function verifyAccess() {
    const pin = pinInput.value.trim();
    if (!/^\d{4}$/.test(pin)) {
      accessError.textContent = 'Ingresá los 4 dígitos.';
      return;
    }

    accessBtn.disabled = true;
    accessBtn.textContent = 'Validando…';
    accessError.textContent = '';

    try {
      const data = await apiGet('auth', { g: slug, pin }, 25000);
      if (!data.ok || !data.token) {
        accessError.textContent = data.error || 'Clave incorrecta.';
        pinInput.select();
        return;
      }

      token = data.token;
      sessionStorage.setItem(`gf-token:${slug}`, token);
      accessBtn.textContent = 'Cargando galería…';
      await openGallery();
    } catch (err) {
      console.error('GF auth/load error', err);
      accessError.textContent = `No se pudo completar el acceso. ${friendlyError(err)}`;
      sessionStorage.removeItem(`gf-token:${slug}`);
      token = '';
    } finally {
      accessBtn.disabled = false;
      accessBtn.textContent = 'Ingresar';
    }
  }

  async function openGallery() {
    const first = await apiGet('photos', { token, page: 1 }, 20000);
    if (!first.ok) throw new Error(first.error || 'Sesión inválida.');

    photos = [...(first.photos || [])];
    showGallery();
    renderPhotos();
    updateSelectionUI();
    apiGet('access', { token }, 10000).catch(() => {});

    const totalPages = Number(first.pages || 1);
    if (totalPages > 1) loadRemainingPages(totalPages);
  }

  function showGallery() {
    lockScreen.hidden = true;
    galleryApp.hidden = false;
    galleryTitle.textContent = gallery.title || 'Galería';
    gallerySubtitle.textContent = gallery.welcome || '';
    downloadAllBtn.hidden = !gallery.allowCompleteDownload;
    protectionNotice.hidden = !!gallery.allowIndividualDownload;
  }

  async function loadRemainingPages(totalPages) {
    for (let page = 2; page <= totalPages; page++) {
      try {
        const next = await apiGet('photos', { token, page }, 20000);
        if (!next.ok) break;
        photos.push(...(next.photos || []));
        renderPhotos();
      } catch (err) {
        console.warn(`No se pudo cargar la página ${page}`, err);
        break;
      }
    }
  }

  function renderPhotos() {
    grid.innerHTML = '';
    if (!photos.length) {
      grid.innerHTML = '<div class="notice">Esta galería todavía no tiene imágenes cargadas.</div>';
      return;
    }

    photos.forEach((photo, index) => {
      const canDownload = !!(gallery.allowIndividualDownload && photo.canDownload);
      const card = document.createElement('article');
      card.className = `photo-card${canDownload ? '' : ' watermark'}`;
      card.dataset.id = photo.id;

      const img = document.createElement('img');
      img.alt = `${gallery.title || 'Galería'} · foto ${photo.code || index + 1}`;
      img.loading = 'lazy';
      img.decoding = 'async';
      img.draggable = false;
      img.style.minHeight = '220px';
      img.style.background = '#111';
      img.addEventListener('contextmenu', e => e.preventDefault());
      img.addEventListener('dragstart', e => e.preventDefault());

      if (photo.preview) {
        img.src = photo.preview;
      } else {
        img.removeAttribute('src');
        loadPreview(photo, img);
      }

      if (canDownload) {
        img.style.cursor = 'zoom-in';
        img.addEventListener('click', () => openLightbox(photo));
      }

      const actions = document.createElement('div');
      actions.className = 'photo-actions';
      const left = document.createElement('div');
      left.className = 'left';
      const right = document.createElement('div');
      right.className = 'right';

      const selectBtn = document.createElement('button');
      selectBtn.className = 'icon-btn';
      selectBtn.type = 'button';
      selectBtn.title = 'Seleccionar para imprimir';
      selectBtn.setAttribute('aria-label', 'Seleccionar para imprimir');
      selectBtn.setAttribute('aria-pressed', selected.has(photo.id) ? 'true' : 'false');
      selectBtn.textContent = '✓';
      if (selected.has(photo.id)) selectBtn.classList.add('selected');
      selectBtn.addEventListener('click', e => {
        e.stopPropagation();
        const isSelected = toggleSelection(photo.id, selectBtn);
        apiGet('favorite', { token, photoId: photo.id, selected: isSelected ? 'SI' : 'NO' }, 10000).catch(() => {});
      });
      left.appendChild(selectBtn);

      if (canDownload) {
        const waBtn = document.createElement('button');
        waBtn.className = 'icon-btn';
        waBtn.type = 'button';
        waBtn.title = 'Compartir';
        waBtn.textContent = 'WA';
        waBtn.addEventListener('click', e => {
          e.stopPropagation();
          sharePhoto(photo);
        });

        const dlBtn = document.createElement('button');
        dlBtn.className = 'icon-btn';
        dlBtn.type = 'button';
        dlBtn.title = 'Descargar fotografía';
        dlBtn.textContent = '↓';
        dlBtn.addEventListener('click', e => {
          e.stopPropagation();
          downloadPhoto(photo);
        });
        right.append(waBtn, dlBtn);
      }

      actions.append(left, right);
      card.append(img, actions);

      if (!canDownload) {
        const badge = document.createElement('div');
        badge.className = 'protected-badge';
        badge.textContent = 'Vista protegida';
        card.appendChild(badge);
      }

      grid.appendChild(card);
    });
  }

  async function loadPreview(photo, img) {
    if (photo.preview || loadingPreviews.has(photo.id)) return;
    loadingPreviews.add(photo.id);
    try {
      const data = await apiGet('preview', { token, file: photo.id }, 25000);
      if (!data.ok || !data.preview) throw new Error(data.error || 'No se pudo cargar la vista previa.');
      photo.preview = data.preview;
      if (img && img.isConnected) img.src = photo.preview;
    } catch (err) {
      console.warn(`Preview falló: ${photo.filename}`, err);
      if (img && img.isConnected) {
        img.alt = `${photo.filename} · vista previa no disponible`;
        img.style.minHeight = '160px';
      }
    } finally {
      loadingPreviews.delete(photo.id);
    }
  }

  function toggleSelection(id, button) {
    if (selected.has(id)) {
      selected.delete(id);
      button.classList.remove('selected');
      button.setAttribute('aria-pressed', 'false');
      updateSelectionUI();
      return false;
    }
    selected.add(id);
    button.classList.add('selected');
    button.setAttribute('aria-pressed', 'true');
    updateSelectionUI();
    return true;
  }

  function updateSelectionUI() {
    const count = selected.size;
    selectedCount.textContent = count;
    selectedCountTop.textContent = count;
    clearSelectionBtn.disabled = count === 0;
    sendPrintBtn.disabled = count === 0;
  }

  clearSelectionBtn.addEventListener('click', () => {
    const ids = [...selected];
    selected.clear();
    renderPhotos();
    updateSelectionUI();
    ids.forEach(id => apiGet('favorite', { token, photoId: id, selected: 'NO' }, 10000).catch(() => {}));
  });

  sendPrintBtn.addEventListener('click', () => {
    if (!selected.size) return;
    const chosen = photos.filter(p => selected.has(p.id));
    const codes = chosen.map(p => p.code || p.filename).join(', ');
    const lines = [
      `Hola Gustavo, quiero solicitar impresiones de la galería “${gallery.title || slug}”.`,
      `Fotos seleccionadas (${chosen.length}): ${codes}`,
      'Quedo a la espera para coordinar tamaño, cantidad y valor.'
    ];
    window.open(`https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`, '_blank', 'noopener,noreferrer');
  });

  async function getOriginal(photo) {
    const data = await apiGet('download', { token, file: photo.id }, 45000);
    if (!data.ok || !data.data) throw new Error(data.error || 'No se pudo obtener la fotografía.');
    const bytes = Uint8Array.from(atob(data.data), c => c.charCodeAt(0));
    return new File([bytes], data.filename || photo.filename || 'foto.jpg', { type: data.mime || 'image/jpeg' });
  }

  async function downloadPhoto(photo) {
    if (!gallery.allowIndividualDownload) return;
    try {
      const file = await getOriginal(photo);
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (err) {
      alert(err.message || 'No se pudo descargar la fotografía.');
    }
  }

  downloadAllBtn.addEventListener('click', async () => {
    if (!gallery.allowCompleteDownload) return;
    for (const photo of photos) {
      await downloadPhoto(photo);
      await new Promise(r => setTimeout(r, 250));
    }
  });

  async function sharePhoto(photo) {
    if (!gallery.allowIndividualDownload) return;
    try {
      const file = await getOriginal(photo);
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: gallery.title || 'GF Fotografía' });
        return;
      }
      await downloadPhoto(photo);
      alert('La imagen fue descargada. Podés adjuntarla en WhatsApp.');
    } catch (err) {
      if (err && err.name !== 'AbortError') alert('No se pudo compartir la fotografía.');
    }
  }

  async function openLightbox(photo) {
    if (!gallery.allowIndividualDownload) return;
    try {
      const file = await getOriginal(photo);
      const url = URL.createObjectURL(file);
      lightboxImg.src = url;
      lightboxImg.dataset.objectUrl = url;
      lightbox.classList.add('open');
      lightbox.setAttribute('aria-hidden', 'false');
    } catch (_) {
      alert('No se pudo ampliar la fotografía.');
    }
  }

  function closeLightbox() {
    const old = lightboxImg.dataset.objectUrl;
    if (old) URL.revokeObjectURL(old);
    delete lightboxImg.dataset.objectUrl;
    lightbox.classList.remove('open');
    lightbox.setAttribute('aria-hidden', 'true');
    lightboxImg.removeAttribute('src');
  }

  lightboxClose.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', e => {
    if (e.target === lightbox) closeLightbox();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeLightbox();
  });
  document.addEventListener('contextmenu', e => {
    if (gallery && !gallery.allowIndividualDownload && galleryApp.contains(e.target)) e.preventDefault();
  });

  async function apiGet(action, params = {}, timeoutMs = 25000) {
    const url = new URL(API);
    url.searchParams.set('action', action);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
    url.searchParams.set('_', Date.now().toString());

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url.toString(), {
        method: 'GET',
        redirect: 'follow',
        cache: 'no-store',
        signal: controller.signal
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  function friendlyError(err) {
    if (!err) return '';
    if (err.name === 'AbortError') return 'La API tardó demasiado en responder.';
    return err.message ? `(${err.message})` : '';
  }
})();
