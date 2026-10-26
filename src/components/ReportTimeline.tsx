import type { Report, Zone } from '../types'
import { formatRecordTime } from '../lib/format'
import { reviewTime } from '../lib/reportJourney'

export function ReportTimeline({ report, zone }: { report: Report; zone?: Zone }) {
  const reviewed = report.status !== 'pending'
  const sending = !!report.submittedAtPending
  const steps = [
    { title: sending ? 'Sending observation' : 'Submitted', detail: formatRecordTime(report.submittedAt, sending), state: sending ? 'current' : 'complete' },
    { title: 'Admin review', detail: reviewed ? 'An administrator has reviewed this observation.' : sending ? 'Available after server acknowledgement.' : 'No decision has been recorded yet.', state: reviewed ? 'complete' : sending ? 'future' : 'current' },
    { title: reviewed ? report.status === 'confirmed' ? 'Approved by admin' : 'Rejected by admin' : 'Admin decision', detail: reviewed ? `Review: ${formatRecordTime(reviewTime(report), report.reviewedAtPending)}` : 'An administrator can approve or reject the report.', state: reviewed ? report.reviewedAtPending ? 'current' : 'complete' : 'future' },
    { title: 'Kept in report history', detail: reviewed && !report.reviewedAtPending ? 'Archived from the default map view. The original report remains available here.' : 'The report remains available here throughout review.', state: reviewed && !report.reviewedAtPending ? 'complete' : 'future' },
  ]
  return <section className="report-journey" aria-label="Report timeline">
    <h4>Report timeline</h4>
    <ol>{steps.map((step, index) => <li key={index} data-state={step.state} aria-current={step.state === 'current' ? 'step' : undefined}><span className="report-journey__number" aria-hidden="true">{step.state === 'complete' ? '✓' : String(index + 1).padStart(2, '0')}</span><div><strong>{step.title}</strong><p>{step.detail}</p></div></li>)}</ol>
    {zone?.status === 'safe' && !reviewed && <p className="report-journey__note">This zone has no alert recorded, so its map marker is hidden. This report is still awaiting review.</p>}
    {reviewed && <p className="report-journey__note">An admin review is a community moderation decision, not laboratory confirmation.</p>}
  </section>
}
