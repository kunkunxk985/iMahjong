import { AVATAR_DATA_URL_MAX_LENGTH, isImageAvatar } from '@pizhou/shared';

const AVATAR_IMAGE_SIZE = 96;
const MAX_SOURCE_AVATAR_BYTES = 8 * 1024 * 1024;

export async function encodeAvatarFile(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('头像仅支持 JPG、PNG 或 WebP 图片');
  }
  if (file.size > MAX_SOURCE_AVATAR_BYTES) {
    throw new Error('图片不能超过 8MB');
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('图片读取失败，请换一张试试'));
      element.src = objectUrl;
    });
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    if (!width || !height) throw new Error('图片尺寸无效，请换一张试试');

    const canvas = document.createElement('canvas');
    canvas.width = AVATAR_IMAGE_SIZE;
    canvas.height = AVATAR_IMAGE_SIZE;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('当前环境不支持头像处理');

    const scale = Math.max(AVATAR_IMAGE_SIZE / width, AVATAR_IMAGE_SIZE / height);
    const drawWidth = width * scale;
    const drawHeight = height * scale;
    context.clearRect(0, 0, AVATAR_IMAGE_SIZE, AVATAR_IMAGE_SIZE);
    context.drawImage(
      image,
      (AVATAR_IMAGE_SIZE - drawWidth) / 2,
      (AVATAR_IMAGE_SIZE - drawHeight) / 2,
      drawWidth,
      drawHeight,
    );

    const webpProbe = canvas.toDataURL('image/webp', 0.82);
    const mime = webpProbe.startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg';
    for (const quality of [0.82, 0.72, 0.62, 0.52]) {
      const encoded = canvas.toDataURL(mime, quality);
      if (isImageAvatar(encoded) && encoded.length <= AVATAR_DATA_URL_MAX_LENGTH) return encoded;
    }
    throw new Error('头像压缩后仍然过大，请换一张图片');
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
