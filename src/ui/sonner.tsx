import {
  Alert01Icon,
  CheckmarkCircle01Icon,
  InformationCircleIcon,
  Loading03Icon,
  OctagonXIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Toaster as Sonner, type ToasterProps } from 'sonner'

const Toaster = ({ ...props }: ToasterProps) => (
  <Sonner
    theme="light"
    className="toaster group"
    icons={{
      success: (
        <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-4" />
      ),
      info: <HugeiconsIcon icon={InformationCircleIcon} className="size-4" />,
      warning: <HugeiconsIcon icon={Alert01Icon} className="size-4" />,
      error: <HugeiconsIcon icon={OctagonXIcon} className="size-4" />,
      loading: (
        <HugeiconsIcon icon={Loading03Icon} className="size-4 animate-spin" />
      ),
    }}
    style={
      {
        '--normal-bg': 'var(--popover)',
        '--normal-text': 'var(--popover-foreground)',
        '--normal-border': 'var(--border)',
        '--border-radius': 'var(--radius)',
      } as React.CSSProperties
    }
    toastOptions={{
      classNames: {
        toast: 'cn-toast',
      },
    }}
    {...props}
  />
)

export { Toaster }
