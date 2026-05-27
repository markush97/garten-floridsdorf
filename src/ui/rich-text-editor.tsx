import Placeholder from '@tiptap/extension-placeholder'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { cn } from '~/lib/ui-utils'

const TOOLBAR_BTN =
  'rounded px-2 py-1 text-xs font-medium text-forest-700 transition-colors hover:bg-forest-900/8 disabled:pointer-events-none disabled:opacity-40'
const TOOLBAR_BTN_ACTIVE = 'bg-forest-900/10 text-forest-900'

interface Props {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  className?: string
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Beschreibung …',
  className,
}: Props) {
  const editor = useEditor({
    extensions: [StarterKit, Placeholder.configure({ placeholder })],
    content: value,
    onUpdate({ editor }) {
      const html = editor.isEmpty ? '' : editor.getHTML()
      onChange(html)
    },
  })

  if (!editor) return null

  return (
    <div
      className={cn(
        'tiptap-editor overflow-hidden rounded-[0.75rem] border border-forest-900/12 bg-white/80 ring-0 transition focus-within:border-forest-900/30 focus-within:ring-2 focus-within:ring-forest-700/20',
        className,
      )}
    >
      {/* Toolbar */}
      <div className="flex flex-wrap gap-0.5 border-b border-forest-900/10 px-2 py-1.5">
        <button
          aria-label="Fett"
          className={cn(
            TOOLBAR_BTN,
            editor.isActive('bold') && TOOLBAR_BTN_ACTIVE,
          )}
          onClick={() => editor.chain().focus().toggleBold().run()}
          type="button"
        >
          <strong>B</strong>
        </button>
        <button
          aria-label="Kursiv"
          className={cn(
            TOOLBAR_BTN,
            editor.isActive('italic') && TOOLBAR_BTN_ACTIVE,
          )}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          type="button"
        >
          <em>I</em>
        </button>
        <span className="mx-1 w-px self-stretch bg-forest-900/10" />
        <button
          aria-label="Aufzählungsliste"
          className={cn(
            TOOLBAR_BTN,
            editor.isActive('bulletList') && TOOLBAR_BTN_ACTIVE,
          )}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          type="button"
        >
          • Liste
        </button>
        <button
          aria-label="Nummerierte Liste"
          className={cn(
            TOOLBAR_BTN,
            editor.isActive('orderedList') && TOOLBAR_BTN_ACTIVE,
          )}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          type="button"
        >
          1. Liste
        </button>
      </div>

      {/* Editor surface */}
      <EditorContent
        className="prose-content text-sm text-forest-900 sm:text-base"
        editor={editor}
      />
    </div>
  )
}
