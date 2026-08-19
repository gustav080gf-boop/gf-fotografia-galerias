# GF Fotografía · Galerías privadas

Frontend para las galerías privadas de GF Fotografía.

## Incluye

- acceso por clave de 4 dígitos mediante hash SHA-256;
- selección para impresión siempre disponible;
- descarga individual y masiva controlada por `allowDownload`;
- WhatsApp de la fotografía deshabilitado cuando `allowDownload=false`;
- ampliación/lightbox deshabilitada cuando `allowDownload=false`;
- clic derecho y arrastre bloqueados en galerías protegidas;
- marca de agua visual sobre previsualizaciones protegidas;
- envío por WhatsApp de la selección destinada a impresión.

## Privacidad

GitHub Pages es un hosting estático. La clave del frontend sirve como barrera visual, pero no reemplaza un backend privado. Los originales no deben guardarse en este repositorio público. Para galerías protegidas conviene servir únicamente previsualizaciones reducidas y marcadas, y mantener los originales en un almacenamiento externo con acceso controlado.

## Configuración

Las galerías se declaran en `config/galerias.js`.

```js
"nombre-galeria": {
  title: "Nombre del evento",
  subtitle: "Galería privada",
  pinHash: "SHA256_DE_LA_CLAVE",
  allowDownload: false,
  whatsappNumber: "549XXXXXXXXXX",
  photos: [
    {
      id: "001",
      preview: "https://.../preview-001.jpg",
      original: "https://.../original-001.jpg"
    }
  ]
}
```

Cuando `allowDownload` es `false`, la aplicación no ofrece descarga, WhatsApp de la foto ni ampliación. La selección para impresión permanece activa en todos los casos.

## Publicación

El repositorio está preparado para publicarse desde la rama `main` mediante GitHub Pages.
