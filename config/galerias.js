// Configuración pública de galerías.
// IMPORTANTE: no guardar aquí archivos originales ni claves en texto plano.
// pinHash debe ser SHA-256 de la clave de 4 dígitos.
// preview: imagen reducida y, para galerías protegidas, preferentemente con marca de agua.
// original: URL del archivo descargable; solo se usa cuando allowDownload=true.
window.GF_GALLERIES = {
  // Ejemplo de estructura:
  // "mi-galeria": {
  //   title: "Nombre del evento",
  //   subtitle: "Galería privada",
  //   pinHash: "SHA256_DE_LA_CLAVE",
  //   allowDownload: false,
  //   whatsappNumber: "549XXXXXXXXXX",
  //   photos: [
  //     { id: "001", preview: "https://.../preview-001.jpg", original: "https://.../original-001.jpg" }
  //   ]
  // }
};
