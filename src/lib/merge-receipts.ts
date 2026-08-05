// Type-only — the implementation is loaded lazily in `mergeReceiptFiles`
// so pdf-lib stays out of the initial bundle.
import type { PDFDocument, PDFImage } from 'pdf-lib'
import { MAX_DOCUMENT_SIZE_BYTES } from '~func/contracts/document'

/**
 * A paper bill rarely fits in one phone photo, so the Kassa upload
 * accepts several files and merges them here — client-side, into a
 * single PDF, one page per photo in the order they were picked. The
 * API still stores exactly one receipt per bill.
 *
 * Photos are re-encoded as JPEG at `MAX_IMAGE_EDGE` before being
 * embedded: a handful of untouched phone pictures would otherwise blow
 * past the upload limit. PDFs picked alongside photos have their pages
 * copied in.
 */

/** Longest edge of an embedded photo, in pixels. */
const MAX_IMAGE_EDGE = 2000
const JPEG_QUALITY = 0.82

/** A4 in PDF points — the page size photos are fitted into. */
const A4_SHORT_EDGE = 595.28
const A4_LONG_EDGE = 841.89
const PAGE_MARGIN = 18

export class ReceiptMergeError extends Error {}

/**
 * Merges `files` into one upload. A single file is passed through
 * untouched (no re-encoding, no PDF wrapper); several files always
 * become a PDF named after `date` (a `YYYY-MM-DD` string).
 */
export async function mergeReceiptFiles(
  files: File[],
  date: string,
): Promise<File> {
  const first = files[0]
  if (first === undefined) {
    throw new ReceiptMergeError('Keine Datei ausgewählt.')
  }
  if (files.length === 1) return first

  const unsupported = files.find(
    (f) => !(f.type === 'application/pdf' || f.type.startsWith('image/')),
  )
  if (unsupported) {
    throw new ReceiptMergeError(
      `„${unsupported.name}“ kann nicht zusammengefügt werden. Mehrere Dateien gehen nur als Fotos oder PDFs.`,
    )
  }

  const { PDFDocument } = await import('pdf-lib')
  const merged = await PDFDocument.create()

  for (const file of files) {
    if (file.type === 'application/pdf') {
      const source = await PDFDocument.load(await file.arrayBuffer())
      const pages = await merged.copyPages(source, source.getPageIndices())
      for (const page of pages) merged.addPage(page)
    } else {
      const jpeg = await toScaledJpeg(file)
      const image = await merged.embedJpg(jpeg.bytes)
      addFittedPage(merged, image, jpeg.width, jpeg.height)
    }
  }

  const bytes = await merged.save()
  if (bytes.byteLength > MAX_DOCUMENT_SIZE_BYTES) {
    throw new ReceiptMergeError(
      `Die zusammengefügte Datei ist zu groß (max ${Math.round(
        MAX_DOCUMENT_SIZE_BYTES / 1024 / 1024,
      )} MB). Bitte weniger Fotos auf einmal hochladen.`,
    )
  }
  return new File([bytes as BlobPart], `beleg-${date}.pdf`, {
    type: 'application/pdf',
  })
}

/** Adds an A4 page in the image's orientation and centers it there. */
function addFittedPage(
  doc: PDFDocument,
  image: PDFImage,
  width: number,
  height: number,
): void {
  const landscape = width > height
  const pageWidth = landscape ? A4_LONG_EDGE : A4_SHORT_EDGE
  const pageHeight = landscape ? A4_SHORT_EDGE : A4_LONG_EDGE
  const page = doc.addPage([pageWidth, pageHeight])
  const scale = Math.min(
    (pageWidth - 2 * PAGE_MARGIN) / width,
    (pageHeight - 2 * PAGE_MARGIN) / height,
  )
  const drawWidth = width * scale
  const drawHeight = height * scale
  page.drawImage(image, {
    x: (pageWidth - drawWidth) / 2,
    y: (pageHeight - drawHeight) / 2,
    width: drawWidth,
    height: drawHeight,
  })
}

/**
 * Decodes an image (honouring its EXIF orientation, so portrait phone
 * photos don't land sideways), scales it down to `MAX_IMAGE_EDGE` and
 * re-encodes it as JPEG — the one format `embedJpg` needs.
 */
async function toScaledJpeg(
  file: File,
): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new ReceiptMergeError(`„${file.name}“ konnte nicht gelesen werden.`)
  }
  const scale = Math.min(
    1,
    MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height),
  )
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const blob = await drawToJpeg(bitmap, width, height)
  bitmap.close()
  return {
    bytes: new Uint8Array(await blob.arrayBuffer()),
    width,
    height,
  }
}

async function drawToJpeg(
  bitmap: ImageBitmap,
  width: number,
  height: number,
): Promise<Blob> {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext('2d')
    if (!ctx)
      throw new ReceiptMergeError('Bild konnte nicht verarbeitet werden.')
    ctx.drawImage(bitmap, 0, 0, width, height)
    return canvas.convertToBlob({ type: 'image/jpeg', quality: JPEG_QUALITY })
  }
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new ReceiptMergeError('Bild konnte nicht verarbeitet werden.')
  ctx.drawImage(bitmap, 0, 0, width, height)
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
  })
  if (!blob)
    throw new ReceiptMergeError('Bild konnte nicht verarbeitet werden.')
  return blob
}
