/**
 * Utility to process an image file to a 256x256 square JPEG
 * and upload it to ImgBB using the SweetLudo 11.5 API Key.
 */

const IMGBB_API_KEY = 'a110b108410dbb7f866f3c34557a86d4';

export async function processAndUploadToImgBB(file: File): Promise<{ imageUrl: string; deleteUrl: string }> {
  // 1. Process image to 256x256 square JPEG via Canvas
  const compressedBlob = await resizeAndCropSquare(file, 256);

  // 2. Prepare FormData
  const formData = new FormData();
  formData.append('image', compressedBlob, `avatar_${Date.now()}.jpg`);

  // 3. Upload to ImgBB
  const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Error al subir la imagen a ImgBB');
  }

  const result = await response.json();
  if (!result.success || !result.data?.url) {
    throw new Error('Respuesta inválida del servidor ImgBB');
  }

  return {
    imageUrl: result.data.url as string,
    deleteUrl: (result.data.delete_url as string) || '',
  };
}

/**
 * Resizes and center-crops an image file into a 256x256 JPEG Blob
 */
function resizeAndCropSquare(file: File, targetSize: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const canvas = document.createElement('canvas');
      canvas.width = targetSize;
      canvas.height = targetSize;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('No se pudo obtener el contexto 2D del Canvas'));
        return;
      }

      // Calculate square center crop
      const minDim = Math.min(img.width, img.height);
      const sx = (img.width - minDim) / 2;
      const sy = (img.height - minDim) / 2;

      ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, targetSize, targetSize);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Fallo al generar Blob de la imagen'));
          }
        },
        'image/jpeg',
        0.8 // 80% quality matching Android implementation
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Error al cargar la imagen seleccionada'));
    };

    img.src = url;
  });
}
