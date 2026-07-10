import { File01Icon, Image01Icon, Pdf01Icon } from '@hugeicons/core-free-icons'

export function fileIcon(contentType: string) {
  if (contentType === 'application/pdf') return Pdf01Icon
  if (contentType.startsWith('image/')) return Image01Icon
  return File01Icon
}

export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} B`
}
