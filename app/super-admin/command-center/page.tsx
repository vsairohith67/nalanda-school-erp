import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { Activity, ArrowRight, Gauge, HeartPulse, LockKeyhole, Smartphone, Sparkles, Stethoscope } from "lucide-react";
import { PageHeader, PageShell, SectionCard } from "@/components/ui";
import { requireRolePermission } from "@/lib/auth";
import { moneyExact } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { getSchoolSettings } from "@/lib/school-settings";
import { getSuperAdminCommandCenter, type CommandCenterMetric, type CommandCenterWidgetState } from "@/lib/super-admin-command-center";

export const dynamic = "force-dynamic";
const NO_CURRENCY_IDS = new Set<string>();
const FEE_CURRENCY_IDS = new Set(["fees"]);
const COMMAND_TIME_FORMATTER = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
const COMMAND_DATE_FORMATTER = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

export default async function SuperAdminCommandCenterPage() {
  noStore();
  const user = await requireRolePermission("VIEW_DASHBOARD", "SUPER_ADMIN");
  const settings = await getSchoolSettings(prisma);
  const commandCenter = await getSuperAdminCommandCenter(prisma, settings.academicYear, user.id);

  return (
    <PageShell className="super-admin-command-center">
      <PageHeader
        title="Command Center"
        description="A private, read-only overview of authorised Nalanda ERP systems. Open the owning module to take action."
        action={<span className="command-read-only"><LockKeyhole size={17} aria-hidden /> Read-only</span>}
      />

      <section className="command-priority" aria-labelledby="command-today-title">
        <div className="command-section-heading"><div><h2 id="command-today-title">Today</h2><p>Highest-priority existing work and school events.</p></div><Gauge size={24} aria-hidden /></div>
        <MetricGrid metrics={commandCenter.today} currencyIds={NO_CURRENCY_IDS} />
      </section>

      <section className="command-section" aria-labelledby="command-pulse-title">
        <div className="command-section-heading"><div><h2 id="command-pulse-title">School pulse</h2><p>Current, authorised operational summaries for {settings.academicYear}.</p></div><HeartPulse size={24} aria-hidden /></div>
        <MetricGrid metrics={commandCenter.schoolPulse} currencyIds={FEE_CURRENCY_IDS} />
      </section>

      <div className="command-two-column">
        <SectionCard title="System health" description="Privacy-safe presentation of OBS-1A; no collector is duplicated." className="command-panel">
          <div className="command-panel-intro">
            <span className={`command-state state-${commandCenter.systemHealth.state.toLowerCase()}`}>{stateText(commandCenter.systemHealth.state)}</span>
            <Link href="/technical-operations">Open Observability <ArrowRight size={16} aria-hidden /></Link>
          </div>
          {commandCenter.systemHealth.data.items.length ? (
            <ul className="command-health-list">
              {commandCenter.systemHealth.data.items.map((item) => (
                <li key={item.id}><span className={`health-dot health-${item.status.toLowerCase()}`} aria-hidden /><div><strong>{item.label}</strong><small>{item.detail}</small></div><span>{item.status.replaceAll("_", " ")}</span></li>
              ))}
            </ul>
          ) : <SourceMessage state={commandCenter.systemHealth.state} message={commandCenter.systemHealth.message} />}
        </SectionCard>

        <SectionCard title="Recent activity" description={`Latest ${commandCenter.recentActivity.data.length} privacy-filtered immutable events.`} className="command-panel">
          <div className="command-panel-intro"><Activity size={18} aria-hidden /><Link href="/access-history">Open detailed audit <ArrowRight size={16} aria-hidden /></Link></div>
          {commandCenter.recentActivity.data.length ? (
            <ol className="command-activity-list">
              {commandCenter.recentActivity.data.map((event, index) => (
                <li key={`${event.time}-${event.module}-${index}`}><time dateTime={event.time}>{formatTime(event.time)}</time><div><strong>{event.action}</strong><span>{event.module} · {event.actor}</span></div><span>{event.result}</span></li>
              ))}
            </ol>
          ) : <SourceMessage state={commandCenter.recentActivity.state} message={commandCenter.recentActivity.message} />}
        </SectionCard>
      </div>

      <section className="command-section" aria-labelledby="quick-access-title">
        <div className="command-section-heading"><div><h2 id="quick-access-title">Quick access</h2><p>Go to an existing module; Command Center does not duplicate its workflow.</p></div><Stethoscope size={24} aria-hidden /></div>
        <nav className="command-link-grid" aria-label="Command Center quick access">
          {commandCenter.quickAccess.map((item) => <Link href={item.href} key={item.href}><span>{item.label}</span><ArrowRight size={17} aria-hidden /></Link>)}
        </nav>
      </section>

      <section className="command-section" aria-labelledby="private-work-summary-title">
        <div className="command-section-heading"><div><h2 id="private-work-summary-title">Private work summary</h2><p>Bounded owner-only Diary, Tasks, Reminders and Directory signals.</p></div><LockKeyhole size={24} aria-hidden /></div>
        {commandCenter.workSummary.data.length ? <MetricGrid metrics={commandCenter.workSummary.data} currencyIds={NO_CURRENCY_IDS} /> : <SourceMessage state={commandCenter.workSummary.state} message={commandCenter.workSummary.message} />}
      </section>

      <section className="command-section" aria-labelledby="work-programme-title">
        <div className="command-section-heading"><div><h2 id="work-programme-title">My work programme</h2><p>Diary / Tasks / Directory → Universal Search → Smart AI</p></div><Sparkles size={24} aria-hidden /></div>
        <div className="command-future-grid">
          {commandCenter.workProgramme.map((item) => item.href
            ? <Link href={item.href} key={item.title}><span>{item.status}</span><h3>{item.title}</h3><p>{item.detail}</p>{item.actionLabel ? <strong className="command-card-action">{item.actionLabel} <ArrowRight size={16} aria-hidden /></strong> : null}</Link>
            : <article key={item.title} aria-disabled="true"><span>{item.status}</span><h3>{item.title}</h3><p>{item.detail}</p></article>)}
        </div>
      </section>

      <div className="command-two-column command-status-columns">
        <SectionCard title="UDISE+" description="Current governed evidence status." className="command-panel">
          <ul className="command-status-list">{commandCenter.udise.map((item) => <li key={item.label}><strong>{item.label}</strong><span>{item.status}</span></li>)}</ul>
          <Link className="command-inline-link" href="/udise">Open existing UDISE material <ArrowRight size={16} aria-hidden /></Link>
        </SectionCard>
        <SectionCard title="Mobile" description="Status only; no native tooling is installed by this phase." className="command-panel">
          <div className="command-panel-intro"><Smartphone size={18} aria-hidden /><span>Web-first foundation</span></div>
          <ul className="command-status-list">{commandCenter.mobile.map((item) => <li key={item.label}><strong>{item.label}</strong><span>{item.status}</span></li>)}</ul>
        </SectionCard>
      </div>

      <p className="command-generated">Private response generated <time dateTime={commandCenter.generatedAt}>{formatTime(commandCenter.generatedAt)}</time>. Unavailable sources are never shown as zero.</p>
    </PageShell>
  );
}

function MetricGrid({ metrics, currencyIds }: { metrics: CommandCenterMetric[]; currencyIds: Set<string> }) {
  return <div className="command-metric-grid">{metrics.map((metric) => (
    <Link className={`command-metric metric-${metric.state.toLowerCase()}`} href={metric.href} key={metric.id}>
      <div><span className={`command-state state-${metric.state.toLowerCase()}`}>{stateText(metric.state)}</span><ArrowRight size={17} aria-hidden /></div>
      <strong>{metric.value === null ? "Not available" : currencyIds.has(metric.id) && typeof metric.value === "number" ? moneyExact(metric.value) : metric.value}</strong>
      <h3>{metric.label}</h3><p>{metric.detail}</p>
      {metric.items?.length ? <ul>{metric.items.map((item) => <li key={`${item.label}-${item.meta}`}><span>{item.label}</span><time dateTime={item.meta}>{formatDate(item.meta)}</time></li>)}</ul> : null}
    </Link>
  ))}</div>;
}

function SourceMessage({ state, message }: { state: CommandCenterWidgetState; message: string | null }) {
  return <div className="command-source-message" role="status"><strong>{state === "EMPTY" ? "No recent activity" : "Not available"}</strong><p>{message ?? "This source has no current records."}</p></div>;
}

function stateText(state: CommandCenterWidgetState) {
  if (state === "OK") return "Available";
  if (state === "EMPTY") return "No current items";
  if (state === "DEGRADED") return "Degraded";
  return "Not available";
}

function formatTime(value: string) {
  return COMMAND_TIME_FORMATTER.format(new Date(value));
}

function formatDate(value: string) {
  return COMMAND_DATE_FORMATTER.format(new Date(value));
}
