import { Download01Icon, PrinterIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { buildPrintDocument, type PdfContext } from '~/lib/event-pdf'
import { Button } from '~/ui/button'
import type { EventWithDetails } from '~func/contracts/event'

type Props = {
  event: EventWithDetails
  /** The latest transcription HTML — pass the editor's draft so the
   *  preview reflects unsaved changes. */
  transcriptionHtml: string
}

const IFRAME_TITLE = 'protokoll-druckvorschau'

/**
 * Renders two adjacent actions on the event editor: "Drucken / PDF"
 * (opens the browser print dialog with the full protocol layout — the
 * user picks "Save as PDF" there) and "HTML herunterladen" (downloads
 * the same self-contained document for archiving). Both go through the
 * same `buildPrintDocument` so the layout is identical.
 *
 * The print view lives in a hidden iframe so it can paginate using the
 * browser's native print engine — that gives us perfect text quality
 * with no extra PDF dependency, and the file the user saves is a real
 * PDF with selectable text, internal links, and embedded fonts.
 */
export default function EventPdfButton({ event, transcriptionHtml }: Props) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const ctxRef = useRef<PdfContext>({ event, transcriptionHtml })

  // Keep the latest ctx in a ref so the iframe `load` handler (registered
  // once) can read the current data without re-binding on every keystroke.
  useEffect(() => {
    ctxRef.current = { event, transcriptionHtml }
  }, [event, transcriptionHtml])

  const getDocument = useCallback(() => {
    return buildPrintDocument(ctxRef.current)
  }, [])

  const handlePrint = useCallback(() => {
    if (typeof window === 'undefined') return
    let frame = iframeRef.current
    if (!frame) {
      frame = document.createElement('iframe')
      frame.title = IFRAME_TITLE
      frame.setAttribute('aria-hidden', 'true')
      frame.tabIndex = -1
      // Sit the iframe off-screen but keep it rendered (display:none
      // would prevent the browser from paginating its contents).
      frame.style.position = 'fixed'
      frame.style.right = '0'
      frame.style.bottom = '0'
      frame.style.width = '0'
      frame.style.height = '0'
      frame.style.border = '0'
      document.body.appendChild(frame)
      iframeRef.current = frame
    }
    const doc = frame.contentDocument
    if (!doc) {
      toast.error('Druckvorschau konnte nicht vorbereitet werden.')
      return
    }
    doc.open()
    doc.write(getDocument())
    doc.close()
    // Wait a tick for the layout to settle, then open the print dialog.
    requestAnimationFrame(() => {
      try {
        frame?.contentWindow?.focus()
        frame?.contentWindow?.print()
      } catch {
        toast.error('Druckdialog konnte nicht geöffnet werden.')
      }
    })
  }, [getDocument])

  const handleDownloadHtml = useCallback(() => {
    if (typeof window === 'undefined') return
    const blob = new Blob([getDocument()], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${slugify(event.title)}-protokoll.html`
    document.body.appendChild(a)
    a.click()
    a.remove()
    // Revoke after a short delay so the browser has time to start the
    // download — revoking too eagerly can cancel it on some platforms.
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [getDocument, event.title])

  // Tear down the iframe on unmount so we don't leak a hidden DOM node.
  useEffect(() => {
    return () => {
      iframeRef.current?.remove()
      iframeRef.current = null
    }
  }, [])

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        aria-label="Protokoll drucken oder als PDF speichern"
        data-testid="event-pdf-print"
        onClick={handlePrint}
        size="sm"
        type="button"
        variant="outline"
      >
        <HugeiconsIcon
          aria-hidden="true"
          icon={PrinterIcon}
          size={14}
          strokeWidth={1.6}
        />
        Drucken / PDF
      </Button>
      <Button
        aria-label="Protokoll als HTML herunterladen"
        data-testid="event-pdf-download"
        onClick={handleDownloadHtml}
        size="sm"
        type="button"
        variant="ghost"
      >
        <HugeiconsIcon
          aria-hidden="true"
          icon={Download01Icon}
          size={14}
          strokeWidth={1.6}
        />
        Als HTML
      </Button>
    </div>
  )
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[äöüÄÖÜß]/g, (c) =>
      c === 'ä' || c === 'Ä'
        ? 'ae'
        : c === 'ö' || c === 'Ö'
          ? 'oe'
          : c === 'ü' || c === 'Ü'
            ? 'ue'
            : 'ss',
    )
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}
