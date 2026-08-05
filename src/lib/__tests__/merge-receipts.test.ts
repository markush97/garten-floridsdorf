import { describe, expect, it } from 'vitest'
import { mergeReceiptFiles, ReceiptMergeError } from '../merge-receipts'

// The merging itself needs canvas/createImageBitmap and is covered by
// driving the real browser; these cover the branches that decide
// whether merging happens at all.

function jpeg(name: string): File {
  return new File([new Uint8Array([0xff, 0xd8, 0xff])], name, {
    type: 'image/jpeg',
  })
}

describe('mergeReceiptFiles', () => {
  it('passes a single file through untouched', async () => {
    const only = jpeg('beleg.jpg')
    await expect(mergeReceiptFiles([only], '2026-08-05')).resolves.toBe(only)
  })

  it('rejects an empty selection', async () => {
    await expect(mergeReceiptFiles([], '2026-08-05')).rejects.toThrow(
      ReceiptMergeError,
    )
  })

  it('names the offending file when a type cannot be merged', async () => {
    const files = [
      jpeg('foto.jpg'),
      new File(['a;b'], 'liste.csv', { type: 'text/csv' }),
    ]
    await expect(mergeReceiptFiles(files, '2026-08-05')).rejects.toThrow(
      /liste\.csv/,
    )
  })
})
