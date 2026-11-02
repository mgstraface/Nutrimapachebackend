/**
 * Achica la foto en el celular antes de mandarla: lado mayor de 1024 px, JPEG.
 * Al redibujarla en un canvas se pierden los metadatos (ubicación GPS, modelo del teléfono).
 */
export async function preparePhoto(file: File, maxSide = 1024): Promise<{ base64: string; dataUrl: string }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('No pudimos abrir esa imagen. Probá con otra.'));
      el.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No pudimos preparar la foto.');
    ctx.drawImage(img, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    return { dataUrl, base64: dataUrl.slice(dataUrl.indexOf(',') + 1) };
  } finally {
    URL.revokeObjectURL(url);
  }
}
