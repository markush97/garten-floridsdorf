import { ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  buildMonthGrid,
  type CalendarSegment,
  type GridCell,
  placeSegments,
  segmentsOnDay,
} from '~/lib/calendar-grid'
import { dayjs } from '~/lib/timezone'
import { cn } from '~/lib/ui-utils'
import { Button } from '~/ui/button'
import { EntryDot, KIND_BAR } from './calendar-ui'

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const
const MAX_LANES = 3
const LANE_H = 24

type CalendarMonthGridProps = {
  monat: string
  todayIso: string
  segments: CalendarSegment[]
  selectedDay: string | null
  isLoading: boolean
  onSelectDay: (iso: string) => void
  onSegmentClick: (segment: CalendarSegment) => void
  onNavigate: (target: -1 | 1 | 'today') => void
}

/**
 * Month view, Monday-first. Below `sm` each day is one tap target
 * with kind dots; from `sm` up the week rows render lane-packed bars
 * (multi-day entries span columns), with a „+N mehr“ button when
 * more than MAX_LANES overlap.
 */
export default function CalendarMonthGrid({
  monat,
  todayIso,
  segments,
  selectedDay,
  isLoading,
  onSelectDay,
  onSegmentClick,
  onNavigate,
}: CalendarMonthGridProps) {
  const weeks = buildMonthGrid(monat, todayIso)
  const monthLabel = dayjs.utc(`${monat}-01`).format('MMMM YYYY')

  return (
    <section
      aria-busy={isLoading}
      className={cn(
        'rounded-[1.25rem] bg-white/75 p-3 shadow-[0_4px_16px_rgba(31,61,43,0.06)] ring-1 ring-inset ring-white/40 backdrop-blur transition-opacity sm:p-5',
        isLoading && 'opacity-60',
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-display text-lg text-forest-900 sm:text-xl">
          {monthLabel}
        </h2>
        <div className="flex items-center gap-1">
          <Button
            onClick={() => onNavigate('today')}
            size="sm"
            type="button"
            variant="outline"
          >
            Heute
          </Button>
          <Button
            aria-label="Vorheriger Monat"
            onClick={() => onNavigate(-1)}
            size="icon"
            type="button"
            variant="ghost"
          >
            <HugeiconsIcon
              aria-hidden="true"
              icon={ArrowLeft01Icon}
              size={18}
              strokeWidth={1.8}
            />
          </Button>
          <Button
            aria-label="Nächster Monat"
            onClick={() => onNavigate(1)}
            size="icon"
            type="button"
            variant="ghost"
          >
            <HugeiconsIcon
              aria-hidden="true"
              icon={ArrowRight01Icon}
              size={18}
              strokeWidth={1.8}
            />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-forest-900/8 pb-1 text-center text-xs font-medium text-forest-700/60">
        {WEEKDAYS.map((weekday) => (
          <div key={weekday}>{weekday}</div>
        ))}
      </div>

      {/* Compact layout: one tap target per day with kind dots. */}
      <div className="sm:hidden">
        {weeks.map((week) => (
          <div className="grid grid-cols-7" key={week[0]?.iso}>
            {week.map((cell) => (
              <CompactDayCell
                cell={cell}
                key={cell.iso}
                onSelect={onSelectDay}
                segments={segmentsOnDay(segments, cell.iso)}
                selected={selectedDay === cell.iso}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Wide layout: day-number row plus lane-packed bars per week. */}
      <div className="hidden sm:block">
        {weeks.map((week) => (
          <WeekRow
            key={week[0]?.iso}
            onSegmentClick={onSegmentClick}
            onSelectDay={onSelectDay}
            segments={segments}
            selectedDay={selectedDay}
            week={week}
          />
        ))}
      </div>
    </section>
  )
}

function CompactDayCell({
  cell,
  segments,
  selected,
  onSelect,
}: {
  cell: GridCell
  segments: CalendarSegment[]
  selected: boolean
  onSelect: (iso: string) => void
}) {
  const label = `${dayjs.utc(cell.iso).format('D. MMMM YYYY')}, ${
    segments.length === 1 ? '1 Eintrag' : `${segments.length} Einträge`
  }`
  return (
    <button
      aria-label={label}
      aria-pressed={selected}
      className={cn(
        'flex min-h-12 flex-col items-center gap-1 rounded-xl py-1.5 transition',
        !cell.inMonth && 'opacity-40',
        selected && 'bg-forest-900/8',
      )}
      onClick={() => onSelect(cell.iso)}
      type="button"
    >
      <span
        className={cn(
          'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs',
          cell.isToday
            ? 'bg-forest-900 font-semibold text-cream-50'
            : 'text-forest-900',
        )}
      >
        {cell.dayOfMonth}
      </span>
      <span className="flex min-h-1.5 items-center gap-0.5">
        {segments.slice(0, 3).map((segment) => (
          <EntryDot kind={segment.kind} key={segment.key} />
        ))}
        {segments.length > 3 && (
          <span className="text-[9px] leading-none text-forest-700/60">
            +{segments.length - 3}
          </span>
        )}
      </span>
    </button>
  )
}

function WeekRow({
  week,
  segments,
  selectedDay,
  onSelectDay,
  onSegmentClick,
}: {
  week: GridCell[]
  segments: CalendarSegment[]
  selectedDay: string | null
  onSelectDay: (iso: string) => void
  onSegmentClick: (segment: CalendarSegment) => void
}) {
  const placements = placeSegments(segments, week)
  const visible = placements.filter((p) => p.lane < MAX_LANES)

  // Days with more entries than visible lanes get a „+N mehr“ button.
  const overflowPerCol = new Map<number, number>()
  for (const placement of placements) {
    if (placement.lane < MAX_LANES) continue
    for (let col = placement.colStart; col <= placement.colEnd; col++) {
      overflowPerCol.set(col, (overflowPerCol.get(col) ?? 0) + 1)
    }
  }
  const usedLanes = Math.min(
    MAX_LANES,
    placements.reduce((max, p) => Math.max(max, p.lane + 1), 0),
  )
  const barsHeight = usedLanes * LANE_H + (overflowPerCol.size > 0 ? 22 : 0)

  return (
    <div className="border-b border-forest-900/6 last:border-b-0">
      <div className="grid grid-cols-7">
        {week.map((cell) => (
          <button
            aria-label={dayjs.utc(cell.iso).format('D. MMMM YYYY')}
            aria-pressed={selectedDay === cell.iso}
            className={cn(
              'flex min-h-9 items-start justify-start px-1 pt-1',
              !cell.inMonth && 'opacity-40',
            )}
            key={cell.iso}
            onClick={() => onSelectDay(cell.iso)}
            type="button"
          >
            <span
              className={cn(
                'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs transition',
                cell.isToday
                  ? 'bg-forest-900 font-semibold text-cream-50'
                  : 'text-forest-900',
                selectedDay === cell.iso &&
                  !cell.isToday &&
                  'ring-2 ring-leaf-500',
              )}
            >
              {cell.dayOfMonth}
            </span>
          </button>
        ))}
      </div>
      <div className="relative mb-1" style={{ height: barsHeight }}>
        {visible.map((placement) => {
          const left = (placement.colStart / 7) * 100
          const right = ((6 - placement.colEnd) / 7) * 100
          const { segment } = placement
          return (
            <button
              className={cn(
                'absolute flex items-center gap-1 truncate px-1.5 text-left text-xs font-medium transition hover:opacity-80',
                KIND_BAR[segment.kind],
                placement.startsInWeek && 'rounded-l-md',
                placement.endsInWeek && 'rounded-r-md',
              )}
              key={`${segment.key}-${week[0]?.iso}`}
              onClick={() => onSegmentClick(segment)}
              style={{
                top: placement.lane * LANE_H,
                left: `calc(${left}% + ${placement.startsInWeek ? 2 : 0}px)`,
                right: `calc(${right}% + ${placement.endsInWeek ? 2 : 0}px)`,
                height: LANE_H - 3,
              }}
              title={
                segment.timeLabel
                  ? `${segment.title} · ${segment.timeLabel}`
                  : segment.title
              }
              type="button"
            >
              {placement.startsInWeek && segment.timeLabel && (
                <span className="shrink-0 tabular-nums opacity-60">
                  {segment.timeLabel.slice(0, 5)}
                </span>
              )}
              <span className="truncate">{segment.title}</span>
            </button>
          )
        })}
        {[...overflowPerCol.entries()].map(([col, count]) => {
          const cell = week[col]
          if (!cell) return null
          return (
            <button
              className="absolute truncate px-1.5 text-left text-[11px] font-medium text-forest-700/70 hover:text-forest-900"
              key={`overflow-${cell.iso}`}
              onClick={() => onSelectDay(cell.iso)}
              style={{
                top: usedLanes * LANE_H,
                left: `calc(${(col / 7) * 100}% + 2px)`,
                width: `calc(${100 / 7}% - 4px)`,
                height: 20,
              }}
              type="button"
            >
              +{count} mehr
            </button>
          )
        })}
      </div>
    </div>
  )
}
