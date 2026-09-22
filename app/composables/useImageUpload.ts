export interface UploadedImage {
  url: string
  publicId: string | null
}

export function useImageUpload() {
  async function uploadImage(file: File, kind: 'icon' | 'background' | 'character'): Promise<UploadedImage> {
    const formData = new FormData()
    formData.append('image', file)
    formData.append('kind', kind)
    return await $fetch<UploadedImage>('/api/upload/image', { method: 'POST', body: formData })
  }

  return { uploadImage }
}
