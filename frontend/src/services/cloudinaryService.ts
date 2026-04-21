const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CHARACTER_PRESET = import.meta.env.VITE_CLOUDINARY_CHARACTER_PRESET;
const BACKGROUND_PRESET = import.meta.env.VITE_CLOUDINARY_BACKGROUND_PRESET;

export type ImageKind = 'character' | 'background';

interface CloudinaryResponse {
  secure_url: string;
  public_id: string;
}

export interface UploadResult {
  url: string;
  publicId: string;
}

export async function uploadImage(file: File, kind: ImageKind): Promise<UploadResult> {
  if (!CLOUD_NAME) throw new Error('Cloudinary non configuré');

  const preset = kind === 'character' ? CHARACTER_PRESET : BACKGROUND_PRESET;
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', preset);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: 'POST', body: formData },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Upload Cloudinary échoué: ${text || res.status}`);
  }

  const data: CloudinaryResponse = await res.json();
  return { url: data.secure_url, publicId: data.public_id };
}
