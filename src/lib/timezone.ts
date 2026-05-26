import dayjs from 'dayjs'
import 'dayjs/locale/de'
import localizedFormat from 'dayjs/plugin/localizedFormat'
import relativeTime from 'dayjs/plugin/relativeTime'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(localizedFormat)
dayjs.extend(relativeTime)
dayjs.locale('de')
dayjs.tz.setDefault('Europe/Vienna')

export { dayjs }

export const DEFAULT_TIMEZONE = 'Europe/Vienna'
