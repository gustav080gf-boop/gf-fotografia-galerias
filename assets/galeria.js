(() => {
  const qs = new URLSearchParams(location.search);
  const slug = (qs.get('g') || '').trim();
  const gallery = window.GF_GALLERIES?.[slug];

  const el = (id) => document.getElementById(id);
  const lockScreen = el('lockScreen');
  const galleryApp = el('galleryApp');
  const pinInput = el('pinInput');
  const accessBtn = el('accessBtn');
  const accessError = el('accessError');
  const lockTitle = el('lockTitle');
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

  const selected = new Set();
  const canDownload = gallery?.allowDownload === true;

  if (!gallery) {
    lockTitle.textContent = 'Galería no disponible';
    pinInput.hidden = true;
    accessBtn.hidden = true;
    accessError.textContent = slug ? 'El enlace de esta galería no está activo.' : 'Falta identificar la galería.';
    return;
  }

  lockTitle.textContent = gallery.title || 'Acceso';
  pinInput.addEventListener('input', () => {
    pinInput.value = pinInput.value.replace(/\D/g, '').slice(0, 4);
  });
  pinInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') verifyAccess();
  });
  accessBtn.addEventListener('click', verifyAccess);

  async function sha256(value) {
    const bytes = new TextEncoder().encode(value);
    const hash = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function verifyAccess() {
    const pin = pinInput.value.trim();
    if (pin.length !== 4) {
      accessError.textContent = 'Ingresá los 4 dígitos.';
      return;
    }
    accessBtn.disabled = true;
    try {
      const digest = await sha256(pin);
      if (digest !== gallery.pinHash) {
        accessError.textContent = 'Clave incorrecta.';
        pinInput.select();
        return;
      }
      sessionStorage.setItem(`gf-access:${slug}`, digest);
      openGallery();
    } finally {
      accessBtn.disabled = false;
    }
  }

  async function restoreSession() {
    const saved = sessionStorage.getItem(`gf-access:${slug}`);
    if (saved && saved === gallery.pinHash) openGallery();
  }

  function openGallery() {
    lockScreen.hidden = true;
    galleryApp.hidden = false;
    galleryTitle.textContent = gallery.title || 'Galería';
    gallerySubtitle.textContent = gallery.subtitle || '';

    // REGLA CENTRAL: la descarga controla descarga, WhatsApp y zoom.
    // La selección para impresión NO depende de allowDownload.
    downloadAllBtn.hidden = !canDownload;
    protectionNotice.hidden = canDownload;

    renderPhotos();
    updateSelectionUI();
  }

  function renderPhotos() {
    grid.innerHTML = '';
    const photos = Array.isArray(gallery.photos) ? gallery.photos : [];
    if (!photos.length) {
      grid.innerHTML = '<div class="notice">Esta galería todavía no tiene imágenes cargadas.</div>';
      return;
    }

    photos.forEach((photo, index) => {
      const card = document.createElement('article');
      card.className = `photo-card${canDownload ? '' : ' watermark'}`;
      card.dataset.id = photo.id;

      const img = document.createElement('img');
      img.src = photo.preview;
      img.alt = `${gallery.title || 'Galería'} · foto ${index + 1}`;
      img.loading = 'lazy';
      img.decoding = 'async';
      img.draggable = false;
      img.addEventListener('contextmenu', e => e.preventDefault());
      img.addEventListener('dragstart', e => e.preventDefault());

      // Solo permitimos ampliación cuando la descarga está habilitada.
      if (canDownload) {
        img.style.cursor = 'zoom-in';
        img.addEventListener('click', () => openLightbox(photo));
      } else {
        img.style.cursor = 'default';
      }

      const actions = document.createElement('div');
      actions.className = 'photo-actions';

      const left = document.createElement('div');
      left.className = 'left';
      const selectBtn = document.createElement('button');
      selectBtn.className = 'icon-btn';
      selectBtn.type = 'button';
      selectBtn.title = 'Seleccionar para imprimir';
      selectBtn.setAttribute('aria-label', 'Seleccionar para imprimir');
      selectBtn.textContent = '✓';
      selectBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleSelection(photo.id, selectBtn);
      });
      left.appendChild(selectBtn);

      const right = document.createElement('div');
      right.className = 'right';

      // Descargar y WhatsApp SOLO existen si allowDownload=true.
      if (canDownload) {
        const waBtn = document.createElement('button');
        waBtn.className = 'icon-btn';
        waBtn.type = 'button';
        waBtn.title = 'Compartir por WhatsApp';
        waBtn.setAttribute('aria-label', 'Compartir por WhatsApp');
        waBtn.textContent = 'WA';
        waBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          shareWhatsApp(photo);
        });

        const dlBtn = document.createElement('button');
        dlBtn.className = 'icon-btn';
        dlBtn.type = 'button';
        dlBtn.title = 'Descargar fotografía';
        dlBtn.setAttribute('aria-label', 'Descargar fotografía');
        dlBtn.textContent = '↓';
        dlBtn.addEventListener('click', (e) => {
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

  function toggleSelection(id, button) {
    if (selected.has(id)) {
      selected.delete(id);
      button.classList.remove('selected');
      button.setAttribute('aria-pressed', 'false');
    } else {
      selected.add(id);
      button.classList.add('selected');
      button.setAttribute('aria-pressed', 'true');
    }
    updateSelectionUI();
  }

  function updateSelectionUI() {
    const count = selected.size;
    selectedCount.textContent = count;
    selectedCountTop.textContent = count;
    clearSelectionBtn.disabled = count === 0;
    sendPrintBtn.disabled = count === 0;
  }

  clearSelectionBtn.addEventListener('click', () => {
    selected.clear();
    grid.querySelectorAll('.icon-btn.selected').forEach(b => b.classList.remove('selected'));
    updateSelectionUI();
  });

  sendPrintBtn.addEventListener('click', () => {
    if (!selected.size) return;
    const ids = [...selected];
    const lines = [
      `Hola Gustavo, quiero solicitar impresiones de la galería “${gallery.title || slug}”.`,
      `Fotos seleccionadas (${ids.length}): ${ids.join(', ')}`,
      'Quedo a la espera para coordinar tamaño, cantidad y valor.'
    ];
    const number = (gallery.whatsappNumber || '').replace(/\D/g, '');
    const url = number
      ? `https://wa.me/${number}?text=${encodeURIComponent(lines.join('\n'))}`
      : `https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  });

  function shareWhatsApp(photo) {
    if (!canDownload) return;
    const text = `Foto ${photo.id} · ${gallery.title || 'GF Fotografía'}\n${photo.original || photo.preview}`;
    const number = (gallery.whatsappNumber || '').replace(/\D/g, '');
    const url = number
      ? `https://wa.me/${number}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function downloadPhoto(photo) {
    if (!canDownload || !photo.original) return;
    const a = document.createElement('a');
    a.href = photo.original;
    a.download = photo.filename || `${photo.id}.jpg`;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  downloadAllBtn.addEventListener('click', () => {
    if (!canDownload) return;
    const photos = (gallery.photos || []).filter(p => p.original);
    photos.forEach((p, i) => setTimeout(() => downloadPhoto(p), i * 250));
  });

  function openLightbox(photo) {
    if (!canDownload) return;
    lightboxImg.src = photo.original || photo.preview;
    lightbox.classList.add('open');
    lightbox.setAttribute('aria-hidden', 'false');
  }

  function closeLightbox() {
    lightbox.classList.remove('open');
    lightbox.setAttribute('aria-hidden', 'true');
    lightboxImg.removeAttribute('src');
  }

  lightboxClose.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLightbox();
  });

  // Barreras básicas adicionales. No existe un bloqueo web 100% efectivo contra capturas.
  document.addEventListener('contextmenu', (e) => {
    if (!canDownload && galleryApp.contains(e.target)) e.preventDefault();
  });

  restoreSession();
})();
