import { cn } from '~/lib/ui-utils'
import { Badge } from '~/ui/badge'
import {
  TASK_INTERVAL_UNIT_LABELS,
  TASK_STATE_LABELS,
  type TaskIntervalUnit,
  type TaskState,
} from '~func/contracts/task'

// Reuse the intern-area form control styling (see kassa-ui).
export { FIELD, SELECT, TEXTAREA } from './kassa-ui'

const STATE_STYLE: Record<TaskState, string> = {
  idee: 'bg-forest-900/8 text-forest-700 ring-1 ring-inset ring-forest-900/12',
  planung: 'bg-sky-500/12 text-sky-700 ring-1 ring-inset ring-sky-500/25',
  ausfuehrung:
    'bg-leaf-500/15 text-forest-700 ring-1 ring-inset ring-leaf-500/30',
  blockiert: 'bg-wood-600/15 text-wood-600 ring-1 ring-inset ring-wood-600/30',
  abgeschlossen:
    'bg-leaf-500/20 text-forest-700 ring-1 ring-inset ring-leaf-500/40',
  abgebrochen:
    'bg-beet-700/12 text-beet-700 ring-1 ring-inset ring-beet-700/25',
}

export function StateBadge({ state }: { state: TaskState }) {
  return (
    <Badge className={cn(STATE_STYLE[state])} variant="outline">
      {TASK_STATE_LABELS[state]}
    </Badge>
  )
}

/** Human-readable recurrence rule, e.g. "Alle 2 Wochen". */
export function intervalLabel(count: number, unit: TaskIntervalUnit): string {
  return `Alle ${count} ${TASK_INTERVAL_UNIT_LABELS[unit]}`
}
