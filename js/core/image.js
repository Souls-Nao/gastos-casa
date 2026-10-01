const MAX_SIDE = 1600;
const QUALITY = 0.8;

function encode(canvas, type) {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, QUALITY);
  });
}

export async function compressImage(file) {
  const image = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();
  const webp = await encode(canvas, 'image/webp');
  return webp?.type === 'image/webp' ? webp : encode(canvas, 'image/jpeg');
}
