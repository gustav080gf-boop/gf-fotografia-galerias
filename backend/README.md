# Backend GF Fotografía · Google Apps Script

Este backend conecta GitHub Pages con la planilla **GF Fotografía — Administración de galerías** y las carpetas privadas de Google Drive.

## 1. Crear el proyecto Apps Script

1. Abrir https://script.google.com/
2. Crear **Nuevo proyecto**.
3. Nombre sugerido: `GF Fotografía Galerías API`.
4. Reemplazar el contenido de `Code.gs` por el archivo `backend/Code.gs` de este repositorio.
5. Guardar.

## 2. Autorizar y desplegar

1. En Apps Script elegir **Implementar > Nueva implementación**.
2. Tipo: **Aplicación web**.
3. Descripción: `API GF Fotografía Galerías`.
4. Ejecutar como: **Yo (Gustavo Ferreyra)**.
5. Quién tiene acceso: **Cualquier usuario** / **Anyone** (la API aplica la clave de cada galería y tokens temporales).
6. Autorizar acceso a Google Sheets, Google Drive y solicitudes externas cuando Google lo solicite.
7. Copiar la URL final que termina en `/exec`.

## 3. Seguridad

- Las carpetas de Drive pueden permanecer privadas.
- El hash de contraseña no se envía al navegador.
- La clave se valida en Apps Script.
- Se emite un token temporal firmado por el servidor.
- La descarga individual solo se entrega si la planilla la habilita.
- La selección para impresión no depende de los permisos de descarga.
- Nunca publicar credenciales, OAuth tokens ni secretos en GitHub.

## 4. Configuración de la web

Una vez obtenida la URL `/exec`, editar `config/api.js` y reemplazar `REEMPLAZAR_URL_APPS_SCRIPT` por esa URL.

Ejemplo:

```js
window.GF_API_URL = 'https://script.google.com/macros/s/XXXXXXXX/exec';
```

## 5. Prueba inicial

La primera galería recomendada para prueba es:

`galeria.html?g=jura-provincial`

La información de esta galería se lee directamente de la hoja `Galerias` de la planilla administrativa.
