// Adapted from Skillry bs-data-visualization-activity-calendar 1.0.1.
// MIT permission notice: docs/activity-calendar-notices.md.
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { activityWeeks } from '../../lib/reportActivity'
import '../../styles/activity-calendar.css'

interface ContributionDay { date: string; count: number }
interface GitHubCalendarProps {
  data: ContributionDay[]
  today: string
  available: boolean
}
const COLORS = ['#18211e', '#1c403b', '#286c61', '#3a9b86', '#49cbb0']
const dateFormatter = new Intl.DateTimeFormat('en-PH', { dateStyle: 'long', timeZone: 'UTC' })
const monthFormatter = new Intl.DateTimeFormat('en-PH', { month: 'short', timeZone: 'UTC' })
const dateLabel = (date: string) => dateFormatter.format(new Date(`${date}T00:00:00Z`))
const monthLabel = (date: string) => monthFormatter.format(new Date(`${date}T00:00:00Z`))

/** The supplied editable calendar grid, adapted for reports and fixed Manila
 * dates. No synthetic contributions, additional chart engine or network calls. */
export function GitHubCalendar({ data, today, available }: GitHubCalendarProps) {
  const [weeks, setWeeks] = useState(12)
  const [selected, setSelected] = useState(today)
  const scroller = useRef<HTMLDivElement>(null)
  const grid = useRef<HTMLDivElement>(null)
  const columns = useMemo(() => activityWeeks(today, weeks), [today, weeks])
  const counts = useMemo(() => new Map(data.map(day => [day.date, day.count])), [data])
  const first = columns[0][0]
  const active = selected >= first && selected <= today ? selected : today
  const total = data.reduce((sum, day) => day.date >= first && day.date <= today ? sum + day.count : sum, 0)
  useEffect(() => { if (scroller.current) scroller.current.scrollLeft = scroller.current.scrollWidth }, [weeks, today])
  function navigate(event: KeyboardEvent<HTMLButtonElement>, date: string) {
    const offsets: Record<string, number> = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7 }
    const offset = offsets[event.key]
    if (offset === undefined && event.key !== 'Home' && event.key !== 'End') return
    event.preventDefault()
    const next = event.key === 'Home' ? first : event.key === 'End' ? today
      : new Date(Date.parse(`${date}T00:00:00Z`) + offset * 86400000).toISOString().slice(0, 10)
    if (next < first || next > today) return
    setSelected(next)
    grid.current?.querySelector<HTMLButtonElement>(`button[data-date="${next}"]`)?.focus()
  }
  return <div className="activity-calendar">
    <div className="activity-calendar__toolbar">
      <p>{available ? `${total} ${total === 1 ? 'report' : 'reports'} in available records` : 'Report history unavailable'}</p>
      <label>Period <select value={weeks} onChange={event => setWeeks(Number(event.target.value))}>
        <option value={12}>12 weeks</option><option value={26}>26 weeks</option><option value={52}>52 weeks</option>
      </select></label>
    </div>
    <div ref={scroller} className="activity-calendar__scroll" role="region" aria-label="Report activity calendar" tabIndex={0}>
      <div className="activity-calendar__layout">
        <div className="activity-calendar__days" aria-hidden="true">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day => <span key={day}>{day}</span>)}</div>
        <div ref={grid} className="activity-calendar__weeks">
          {columns.map((days, index) => <div key={days[0]} className="activity-calendar__week">
            <span className="activity-calendar__month" aria-hidden="true">{(index === 0 && !columns.slice(1, 3).some(week => week.some(day => day.slice(-2) === '01'))) || days.some(day => day.slice(-2) === '01' && day <= today) ? monthLabel(days.find(day => day.slice(-2) === '01') ?? days[0]) : ''}</span>
            {days.map(date => {
              const future = date > today
              const count = counts.get(date) ?? 0
              const label = `${dateLabel(date)}: ${available ? `${count} ${count === 1 ? 'report' : 'reports'} in available records` : 'data unavailable'}`
              return future ? <span key={date} className="activity-calendar__cell activity-calendar__cell--future" aria-hidden="true" />
                : <button key={date} type="button" className="activity-calendar__cell" data-date={date}
                  style={{ backgroundColor: available ? COLORS[Math.min(count, 4)] : undefined }}
                  aria-label={label} title={label} aria-pressed={date === active} tabIndex={date === active ? 0 : -1}
                  onClick={() => setSelected(date)} onKeyDown={event => navigate(event, date)} />
            })}
          </div>)}
        </div>
      </div>
    </div>
    <p className="activity-calendar__selection" aria-live="polite" aria-atomic="true">{dateLabel(active)} · {available ? `${counts.get(active) ?? 0} ${(counts.get(active) ?? 0) === 1 ? 'report' : 'reports'}` : 'data unavailable'}</p>
    <div className="activity-calendar__legend"><span>0</span>{COLORS.map((color) => <span key={color} className="activity-calendar__cell" style={{ backgroundColor: color }} aria-hidden="true" />)}<span>4+ reports per day</span></div>
    <p className="activity-calendar__hint">Select a day. Use arrow keys or scroll longer periods.</p>
  </div>
}
