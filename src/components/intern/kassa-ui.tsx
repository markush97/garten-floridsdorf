import { cn } from '~/lib/ui-utils'
import { Badge } from '~/ui/badge'
import {
  EXPENSE_STATUS_LABELS,
  type ExpenseStatus,
} from '~func/contracts/bookkeeping'

/**
 * Shared presentation for the Kassa (bookkeeping) module: form-control
 * styling (kept in sync with the admin `form-ui` constants) plus the
 * status badge. Pure presentation, no data.
 */

export const FIELD =
  'w-full rounded-2xl border border-forest-900/12 bg-white/80 px-4 py-2.5 text-base text-forest-900 placeholder:text-forest-700/45 focus-visible:border-forest-700 focus-visible:ring-2 focus-visible:ring-forest-700/30 focus-visible:outline-none'

export const SELECT =
  'h-11 w-full rounded-2xl border border-forest-900/12 bg-white/80 px-4 text-base text-forest-900 focus-visible:border-forest-700 focus-visible:ring-2 focus-visible:ring-forest-700/30 focus-visible:outline-none'

export const TEXTAREA =
  'min-h-20 w-full rounded-2xl border border-forest-900/12 bg-white/80 px-4 py-3 text-base text-forest-900 placeholder:text-forest-700/45 focus-visible:border-forest-700 focus-visible:ring-2 focus-visible:ring-forest-700/30 focus-visible:outline-none'

const STATUS_STYLE: Record<ExpenseStatus, string> = {
  pending: 'bg-wood-600/15 text-wood-600 ring-1 ring-inset ring-wood-600/30',
  approved: 'bg-leaf-500/15 text-forest-700 ring-1 ring-inset ring-leaf-500/30',
  rejected: 'bg-beet-700/12 text-beet-700 ring-1 ring-inset ring-beet-700/25',
}

export function StatusBadge({ status }: { status: ExpenseStatus }) {
  return (
    <Badge className={cn(STATUS_STYLE[status])} variant="outline">
      {EXPENSE_STATUS_LABELS[status]}
    </Badge>
  )
}
