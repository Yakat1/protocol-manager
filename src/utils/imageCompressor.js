/**
 * Utilidad asíncrona para re-escalar y comprimir imágenes vía HTML5 Canvas
 * antes de inyectarlas en Base64 al estado de la aplicación.
 * Previene el congelamiento de la memoria (Quota o RAM) al lidiar con fotos enormes.
 */

export function compressImage(file, maxWidth = 1280, quality = 0.8) {
  return new Promise((resolve, reject) => {
    // Si el archivo no es imagen, se descarta la compresión
    if (!file.type.match(/image.*/)) {
      reject(new Error("El archivo no es una imagen válida"));
      return;
    }

    const reader = new FileReader();
    
    // 1. Leer archivo hacia RAM efímera
    reader.readAsDataURL(file);
    
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      
      // 2. Cuando la imagen carga, aplicar compresión de Canvas
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Mantener la relación de aspecto si la anchura excede el máximo permitido
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        // Dibujado suave de la imagen sobre el lienzo virtual
        ctx.drawImage(img, 0, 0, width, height);

        // 3. Exportar el lienzo final en JPEG (descarta canal Alpha si existe PNG, reduciendo megabytes a kilobytes)
        const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
        
        resolve(compressedBase64);
      };

      img.onerror = (error) => reject(error);
    };
    
    reader.onerror = (error) => reject(error);
  });
}
