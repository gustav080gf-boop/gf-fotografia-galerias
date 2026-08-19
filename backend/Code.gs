const GF = {
  SPREADSHEET_ID: '1XZV4IKb5xKdtRZcTQF_i6LhjJo0ZJEvr4VkTO0vY_x0',
  SHEET_GALLERIES: 'Galerias',
  TOKEN_TTL_SECONDS: 60 * 60 * 6,
  PAGE_SIZE: 12,
  PREVIEW_SIZE: 700,
  API_VERSION: '2026-08-19.1'
};

let GF_JSONP_CALLBACK = '';

function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    GF_JSONP_CALLBACK = safeCallback_(p.prefix);
    const action = String(p.action || 'gallery').toLowerCase();

    if (action === 'gallery') return json_(getGalleryPublic_(p.g));
    if (action === 'auth') return json_(authenticate_(p.g, p.pin));
    if (action === 'photos') return json_(getPhotos_(p.token, Number(p.page || 1)));
    if (action === 'preview') return json_(getPreview_(p.token, p.file));
    if (action === 'download') return json_(getDownload_(p.token, p.file));
    if (action === 'favorite') return json_(saveFavorite_(p.token, p.photoId, yes_(p.selected)));
    if (action === 'access') return json_(registerAccess_(p.token));

    return json_({ ok: false, error: 'Acción no válida.', apiVersion: GF.API_VERSION });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err), apiVersion: GF.API_VERSION });
  }
}

function doPost(e) {
  try {
    GF_JSONP_CALLBACK = '';
    const body = JSON.parse((e.postData && e.postData.contents) || '{}');
    const action = String(body.action || '').toLowerCase();
    if (action === 'auth') return json_(authenticate_(body.g, body.pin));
    if (action === 'favorite') return json_(saveFavorite_(body.token, body.photoId, !!body.selected));
    if (action === 'access') return json_(registerAccess_(body.token));
    return json_({ ok: false, error: 'Acción no válida.', apiVersion: GF.API_VERSION });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err), apiVersion: GF.API_VERSION });
  }
}

function getGalleryPublic_(slug) {
  const g = findGallery_(slug);
  if (!g) return { ok: false, error: 'Galería no encontrada.', apiVersion: GF.API_VERSION };
  if (!isGalleryAvailable_(g)) return { ok: false, error: 'La galería no está disponible.', apiVersion: GF.API_VERSION };
  return {
    ok: true,
    apiVersion: GF.API_VERSION,
    gallery: {
      id: g.ID,
      slug: g.Slug,
      title: g['Nombre de la galería'],
      client: g['Nombre del cliente'],
      eventType: g['Tipo de evento'],
      eventDate: g['Fecha del evento'],
      welcome: g['Texto de bienvenida'],
      expires: g['Fecha de vencimiento'],
      allowIndividualDownload: yes_(g['Permitir descarga individual']),
      allowCompleteDownload: yes_(g['Permitir descarga completa']),
      selectionEnabled: true,
      watermark: {
        enabled: yes_(g['Aplicar sello de agua']),
        text: g['Texto del sello de agua'] || 'GF FOTOGRAFÍA',
        opacity: Number(g['Opacidad del sello (%)'] || 50),
        position: g['Posición del sello'] || 'REPETIDO',
        size: g['Tamaño del sello'] || 'MEDIANO'
      }
    }
  };
}

function authenticate_(slug, pin) {
  const g = findGallery_(slug);
  if (!g || !isGalleryAvailable_(g)) return { ok: false, error: 'Galería no disponible.', apiVersion: GF.API_VERSION };
  pin = String(pin || '').trim();
  if (!/^\d{4}$/.test(pin)) return { ok: false, error: 'Clave inválida.', apiVersion: GF.API_VERSION };
  const digest = sha256Hex_(pin);
  if (digest !== String(g['Hash de contraseña'] || '').trim().toLowerCase()) {
    return { ok: false, error: 'Clave incorrecta.', apiVersion: GF.API_VERSION };
  }
  const token = makeToken_({ g: g.Slug, exp: Math.floor(Date.now() / 1000) + GF.TOKEN_TTL_SECONDS });
  return { ok: true, token: token, expiresIn: GF.TOKEN_TTL_SECONDS, apiVersion: GF.API_VERSION };
}

function getPhotos_(token, page) {
  const auth = verifyToken_(token);
  const g = findGallery_(auth.g);
  if (!g || !isGalleryAvailable_(g)) throw new Error('Galería no disponible.');
  page = Math.max(1, page || 1);

  const folderId = String(g['ID de carpeta de Google Drive'] || '').trim();
  const folder = DriveApp.getFolderById(folderId);
  const files = folder.getFiles();
  const all = [];
  while (files.hasNext()) {
    const f = files.next();
    if (/^image\//i.test(f.getMimeType())) {
      all.push({ id: f.getId(), name: f.getName(), mime: f.getMimeType() });
    }
  }

  all.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  const start = (page - 1) * GF.PAGE_SIZE;
  const slice = all.slice(start, start + GF.PAGE_SIZE);
  const photos = slice.map((f, i) => ({
    id: f.id,
    code: String(start + i + 1).padStart(3, '0'),
    filename: f.name,
    mime: f.mime,
    canDownload: yes_(g['Permitir descarga individual'])
  }));

  return {
    ok: true,
    apiVersion: GF.API_VERSION,
    page: page,
    pageSize: GF.PAGE_SIZE,
    total: all.length,
    pages: Math.ceil(all.length / GF.PAGE_SIZE),
    photos: photos
  };
}

function getPreview_(token, fileId) {
  const auth = verifyToken_(token);
  const g = findGallery_(auth.g);
  if (!g || !isGalleryAvailable_(g)) throw new Error('Galería no disponible.');
  assertFileInGallery_(g, fileId);
  return {
    ok: true,
    apiVersion: GF.API_VERSION,
    file: fileId,
    preview: getPreviewDataUrl_(fileId, GF.PREVIEW_SIZE)
  };
}

function getDownload_(token, fileId) {
  const auth = verifyToken_(token);
  const g = findGallery_(auth.g);
  if (!g || !isGalleryAvailable_(g)) throw new Error('Galería no disponible.');
  if (!yes_(g['Permitir descarga individual'])) throw new Error('La descarga está deshabilitada.');
  assertFileInGallery_(g, fileId);
  const f = DriveApp.getFileById(fileId);
  const blob = f.getBlob();
  return {
    ok: true,
    apiVersion: GF.API_VERSION,
    filename: f.getName(),
    mime: blob.getContentType(),
    data: Utilities.base64Encode(blob.getBytes())
  };
}

function saveFavorite_(token, photoId, selected) {
  const auth = verifyToken_(token);
  const g = findGallery_(auth.g);
  if (!g || !isGalleryAvailable_(g)) throw new Error('Galería no disponible.');
  assertFileInGallery_(g, photoId);
  const ss = SpreadsheetApp.openById(GF.SPREADSHEET_ID);
  const sh = ss.getSheetByName('Favoritas');
  if (!sh) return { ok: true, apiVersion: GF.API_VERSION };
  sh.appendRow([new Date(), g.ID, g.Slug, photoId, selected ? 'SI' : 'NO', 'WEB']);
  return { ok: true, apiVersion: GF.API_VERSION };
}

function registerAccess_(token) {
  const auth = verifyToken_(token);
  const g = findGallery_(auth.g);
  if (!g) return { ok: false, apiVersion: GF.API_VERSION };
  const ss = SpreadsheetApp.openById(GF.SPREADSHEET_ID);
  const sh = ss.getSheetByName('Accesos');
  if (sh) sh.appendRow([new Date(), g.ID, g.Slug, 'WEB', 'GitHub Pages']);
  return { ok: true, apiVersion: GF.API_VERSION };
}

function getPreviewDataUrl_(fileId, width) {
  const token = ScriptApp.getOAuthToken();
  const metaUrl = 'https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(fileId) + '?fields=thumbnailLink,mimeType';
  const metaResp = UrlFetchApp.fetch(metaUrl, {
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: true
  });
  if (metaResp.getResponseCode() >= 300) throw new Error('No se pudo generar la vista previa.');
  const meta = JSON.parse(metaResp.getContentText());

  if (!meta.thumbnailLink) {
    const blob = DriveApp.getFileById(fileId).getBlob();
    return 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes());
  }

  const url = meta.thumbnailLink.replace(/=s\d+$/, '=s' + width);
  const imgResp = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: true
  });
  if (imgResp.getResponseCode() >= 300) throw new Error('No se pudo cargar la vista previa.');
  const blob = imgResp.getBlob();
  return 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes());
}

function findGallery_(slug) {
  slug = String(slug || '').trim().toLowerCase();
  if (!slug) return null;
  const sh = SpreadsheetApp.openById(GF.SPREADSHEET_ID).getSheetByName(GF.SHEET_GALLERIES);
  const values = sh.getDataRange().getDisplayValues();
  if (values.length < 2) return null;
  const headers = values[0];
  for (let r = 1; r < values.length; r++) {
    if (String(values[r][1] || '').trim().toLowerCase() === slug) {
      const obj = {};
      headers.forEach((h, i) => obj[h] = values[r][i]);
      obj._row = r + 1;
      return obj;
    }
  }
  return null;
}

function isGalleryAvailable_(g) {
  if (String(g.Estado || '').trim().toUpperCase() !== 'ACTIVA') return false;
  const exp = parseDate_(g['Fecha de vencimiento']);
  return !exp || exp.getTime() >= new Date().setHours(0, 0, 0, 0);
}

function parseDate_(value) {
  const s = String(value || '').trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), 23, 59, 59);
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function assertFileInGallery_(g, fileId) {
  const folder = DriveApp.getFolderById(String(g['ID de carpeta de Google Drive'] || '').trim());
  const it = folder.getFiles();
  while (it.hasNext()) if (it.next().getId() === fileId) return true;
  throw new Error('Archivo no autorizado para esta galería.');
}

function yes_(v) {
  return ['SI', 'SÍ', 'TRUE', '1', 'YES'].indexOf(String(v || '').trim().toUpperCase()) >= 0;
}

function sha256Hex_(text) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8);
  return bytes.map(b => ((b < 0 ? b + 256 : b).toString(16).padStart(2, '0'))).join('');
}

function secret_() {
  const props = PropertiesService.getScriptProperties();
  let secret = props.getProperty('GF_TOKEN_SECRET');
  if (!secret) {
    secret = Utilities.getUuid() + Utilities.getUuid() + Utilities.getUuid();
    props.setProperty('GF_TOKEN_SECRET', secret);
  }
  return secret;
}

function makeToken_(payload) {
  const body = Utilities.base64EncodeWebSafe(JSON.stringify(payload)).replace(/=+$/, '');
  const sig = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(body, secret_())).replace(/=+$/, '');
  return body + '.' + sig;
}

function verifyToken_(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 2) throw new Error('Sesión inválida.');
  const expected = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(parts[0], secret_())).replace(/=+$/, '');
  if (expected !== parts[1]) throw new Error('Sesión inválida.');
  const payload = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString());
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) throw new Error('La sesión venció.');
  return payload;
}

function safeCallback_(value) {
  const cb = String(value || '').trim();
  return /^[A-Za-z_$][0-9A-Za-z_$\.]*$/.test(cb) ? cb : '';
}

function json_(obj) {
  const text = JSON.stringify(obj);
  if (GF_JSONP_CALLBACK) {
    return ContentService.createTextOutput(GF_JSONP_CALLBACK + '(' + text + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(text)
    .setMimeType(ContentService.MimeType.JSON);
}
