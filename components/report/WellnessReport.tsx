import { bodySystems, STATUS_META, mockData, report } from '@/lib/data'
import type { KindrReport, ReportFinding, FindingGroup, Palette } from '@/lib/report'
import type { Pillar } from '@/lib/findings-config'

// ── Palette → style ───────────────────────────────────────────────────────────

const P: Record<Palette, { dot: string; bg: string; edge: string; text: string }> = {
  sage:  { dot: '#7C8A6B', bg: '#E7EADB', edge: '#CBD4BB', text: '#4f5d40' },
  ochre: { dot: '#C0863A', bg: '#F3E6CD', edge: '#E4CFA4', text: '#7e5a1f' },
  brick: { dot: '#A24B36', bg: '#F1DDD4', edge: '#E3C2B4', text: '#7d4538' },
  clay:  { dot: '#A98C6A', bg: '#ECE2D2', edge: '#DBCBB2', text: '#6f5c40' },
  cream: { dot: '#9A9478', bg: '#FAF6E3', edge: '#D8D0A8', text: '#6B6650' },
}

const PILLAR_STYLE: Record<Pillar, { bg: string; text: string; edge: string }> = {
  Nourish:  { bg: '#E6F2DE', text: '#4A7A32', edge: '#C6DFB8' },
  Move:     { bg: '#DDE9F5', text: '#2A5A80', edge: '#B8D3EC' },
  Calm:     { bg: '#F5EFE0', text: '#7A6A52', edge: '#E2D8C4' },
  Clinical: { bg: '#F1DDD4', text: '#7d4538', edge: '#E3C2B4' },
}

// ── Sub-components ────────────────────────────────────────────────────────────

/** Sprouting leaf used in strengths + footer */
function SproutIcon() {
  return (
    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none">
      <path d="M12 22v-8" stroke="#5e6b4f" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M12 15c0-3-2-5-6-5 0 3 2 5 6 5Z" fill="#8a9a7b" />
      <path d="M12 13c0-3 2-5 6-5 0 3-2 5-6 5Z" fill="#7C8A6B" />
    </svg>
  )
}

/** Threads — connected findings, rendered as a threaded list */
function Threads({ related }: { related: ReportFinding['related'] }) {
  if (!related.length) return null
  return (
    <div className="mt-3.5 pt-3 border-t border-border">
      <p className="text-[10px] tracking-[.14em] uppercase font-semibold text-ink-2 mb-2.5">
        Connected to
      </p>
      <div className="pl-3.5 border-l-2 border-clay-edge flex flex-col gap-2">
        {related.map(r => (
          <div key={r.id || r.title} className="flex gap-2 items-start">
            <div
              className="w-[7px] h-[7px] rounded-full shrink-0 mt-[5px] border-[1.5px]"
              style={{ background: '#FAF6E3', borderColor: '#A98C6A' }}
            />
            <p className="text-[12.5px] text-ink-2 leading-snug">
              <span className="font-semibold text-ink">{r.title}</span>
              {' — '}{r.note}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Individual finding card */
function FindingCard({ f }: { f: ReportFinding }) {
  const p = P[f.palette]
  return (
    <div className="relative bg-bg-soft border border-border rounded-2xl pl-[22px] pr-5 py-[18px] mt-3.5 overflow-hidden">
      {/* coloured left spine */}
      <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: p.dot }} />

      {/* title + tag row */}
      <div className="flex items-start gap-3 justify-between">
        <h4 className="text-[17px] font-medium text-ink leading-snug tracking-[-0.005em] flex-1">
          {f.title}
        </h4>
        <span
          className="text-[10.5px] tracking-[.04em] font-semibold px-2.5 py-1 rounded-full shrink-0 border whitespace-nowrap"
          style={{ background: p.bg, color: p.text, borderColor: p.edge }}
        >
          {f.severityLabel}
        </span>
      </div>

      {/* detail */}
      <p className="text-[14px] text-ink-2 mt-2 leading-relaxed">{f.detail}</p>

      {/* managed note */}
      {f.managedNote && (
        <div className="mt-3 bg-card border border-dashed border-border rounded-xl px-3 py-2.5">
          <p className="text-[12.5px] text-ink-2 leading-relaxed">{f.managedNote}</p>
        </div>
      )}

      {/* markers + pillars row — pillars always pushed to the right */}
      {(f.markers.length > 0 || f.pillars.length > 0) && (
        <div className="flex flex-wrap gap-1.5 mt-3.5 items-center">
          {f.markers.map(m => (
            <span
              key={m}
              className="font-mono text-[11px] px-2 py-0.5 border border-border rounded-lg text-ink-2 bg-card"
            >
              {m}
            </span>
          ))}
          <span className="flex-1" />
          {f.pillars.map(pl => {
            const ps = PILLAR_STYLE[pl as Pillar]
            return ps ? (
              <span
                key={pl}
                className="text-[11px] font-medium px-2.5 py-0.5 rounded-full border"
                style={{ background: ps.bg, color: ps.text, borderColor: ps.edge }}
              >
                {pl}
              </span>
            ) : null
          })}
        </div>
      )}

      <Threads related={f.related} />
    </div>
  )
}

/** Finding group — one section (priorities / monitor / optimize) */
function Group({ g }: { g: FindingGroup }) {
  const p = P[g.palette]
  return (
    <section className="mt-10">
      <header>
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-0.5 rounded-full" style={{ background: p.dot }} />
          <p
            className="text-[12px] tracking-[.13em] uppercase font-semibold"
            style={{ color: p.text }}
          >
            {g.title}
          </p>
        </div>
        <p className="text-[13.5px] text-ink-2 mt-1.5 leading-relaxed">{g.blurb}</p>
      </header>
      {g.findings.map(f => <FindingCard key={f.id} f={f} />)}
    </section>
  )
}

/** Strengths — sage gradient section */
function Strengths({ strengths }: { strengths: ReportFinding[] }) {
  if (!strengths.length) return null
  return (
    <section
      className="mt-12 rounded-[22px] border p-6"
      style={{
        background: 'linear-gradient(180deg, #E7EADB 0%, #FAF6E3 100%)',
        borderColor: '#CBD4BB',
      }}
    >
      <div className="flex items-center gap-2.5 mb-1" style={{ color: '#4f5d40' }}>
        <div className="w-6 h-0.5 rounded-full bg-sage" />
        <p className="text-[12px] tracking-[.13em] uppercase font-semibold">What&apos;s working</p>
      </div>
      <p className="text-[13.5px] leading-relaxed" style={{ color: '#5a6650' }}>
        Worth protecting — these are the foundations the plan builds on.
      </p>

      <div className="mt-4">
        {strengths.map(s => (
          <div
            key={s.id}
            className="flex gap-3 items-start py-3.5 border-b last:border-0"
            style={{ borderColor: '#CBD4BB' }}
          >
            <SproutIcon />
            <div>
              <p className="text-[15.5px] font-medium text-ink mb-0.5">{s.title}</p>
              <p className="text-[13.5px] leading-relaxed" style={{ color: '#5a6650' }}>
                {s.detail}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

/** Triage banner — only shown when a referral is needed */
function TriageBanner({ triage }: { triage: NonNullable<KindrReport['triage']> }) {
  const p = P.brick
  return (
    <div
      className="rounded-2xl border p-5 mb-6"
      style={{ background: p.bg, borderColor: p.edge }}
    >
      <div className="flex items-center gap-3 mb-2">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10.5" fill="#fff" stroke="#A24B36" strokeWidth="1.3" />
          <path d="M12 8v8M8 12h8" stroke="#A24B36" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <h3 className="font-serif text-[19px] leading-snug" style={{ color: p.dot }}>
          {triage.title}
        </h3>
      </div>
      <p className="text-[13.5px] mb-4 leading-relaxed" style={{ color: '#7d4538' }}>
        {triage.message}
      </p>
      <ul className="flex flex-col gap-3">
        {triage.items.map((item, i) => (
          <li key={i} className="flex gap-3 items-start">
            <div
              className="w-1.5 h-1.5 rounded-full shrink-0 mt-2"
              style={{ background: p.dot }}
            />
            <div>
              <p className="text-[13.5px] font-semibold text-ink">{item.title}</p>
              <p className="text-[12.5px] text-ink-2 leading-snug mt-0.5">{item.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** All body systems — matches dashboard visual, 2-col grid */
function SystemsGarden({
  counts,
}: {
  counts: KindrReport['snapshot']['counts']
}) {
  return (
    <div className="bg-bg-soft rounded-2xl border border-border p-5 mb-6">
      {/* header row */}
      <div className="flex items-center justify-between mb-1">
        <p className="text-[11px] tracking-[.12em] uppercase font-semibold text-ink-2">
          Body systems
        </p>
        <div className="flex items-center gap-3">
          {([
            { label: 'Optimal',         color: '#2E7D32' },
            { label: 'Monitor',         color: '#C77D2E' },
            { label: 'Needs attention', color: '#C0392B' },
          ] as const).map(({ label, color }) => (
            <div key={label} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
              <span className="text-[10px] text-ink-2">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 2-col grid — mirrors the dashboard mobile list */}
      <div className="grid grid-cols-2 gap-x-4 mt-3 mb-4">
        {bodySystems.map(sys => {
          const meta = STATUS_META[sys.status]
          return (
            <div
              key={sys.id}
              className="flex items-center gap-2.5 py-2.5 border-b border-dotted border-border last:border-0"
            >
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{
                  background: meta.color,
                  boxShadow: `0 0 0 3px ${meta.color}22`,
                }}
              />
              <span className="flex-1 text-[12.5px] font-medium text-ink truncate">
                {sys.name}
              </span>
              <span className="text-[10.5px] shrink-0" style={{ color: meta.color }}>
                {meta.label}
              </span>
            </div>
          )
        })}
      </div>

      {/* finding count chips */}
      <div className="flex flex-wrap gap-2">
        {counts.priorities > 0 && (
          <span className="text-[12px] px-3 py-1.5 rounded-full border border-border bg-card text-ink-2">
            <span className="font-semibold text-ink">{counts.priorities}</span> to focus on
          </span>
        )}
        {counts.monitor > 0 && (
          <span className="text-[12px] px-3 py-1.5 rounded-full border border-border bg-card text-ink-2">
            <span className="font-semibold text-ink">{counts.monitor}</span> to monitor
          </span>
        )}
        {counts.optimize > 0 && (
          <span className="text-[12px] px-3 py-1.5 rounded-full border border-border bg-card text-ink-2">
            <span className="font-semibold text-ink">{counts.optimize}</span> to optimize
          </span>
        )}
        {counts.strengths > 0 && (
          <span className="text-[12px] px-3 py-1.5 rounded-full border border-border bg-card text-ink-2">
            <span className="font-semibold text-ink">{counts.strengths}</span>{' '}
            {counts.strengths === 1 ? 'strength' : 'strengths'}
          </span>
        )}
      </div>
    </div>
  )
}

/** Footer — pillars focus line + reassessment line + disclaimer. */
function Footer({ r }: { r: KindrReport }) {
  const raw = mockData.user.reassessmentDate
  const dateFormatted = new Date(raw + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <footer className="mt-12 pt-5 border-t border-border">
      {/* pillars focus line */}
      {r.focus.length > 0 && (
        <div className="flex items-center flex-wrap gap-2 mb-4">
          <span className="text-[13px] text-ink-2">Your plan will focus on</span>
          {r.focus.map(f => {
            const ps = PILLAR_STYLE[f.pillar as Pillar]
            return ps ? (
              <span
                key={f.pillar}
                className="text-[13px] font-semibold px-3 py-1 rounded-full border"
                style={{ background: ps.bg, color: ps.text, borderColor: ps.edge }}
              >
                {f.label}
              </span>
            ) : null
          })}
        </div>
      )}

      {/* reassessment line */}
      <div className="flex items-center gap-3 bg-bg-soft border border-border rounded-2xl px-4 py-3.5 mb-5">
        <SproutIcon />
        <p className="text-[13.5px] text-ink leading-snug">
          We&apos;ll check in again in{' '}
          <span className="font-semibold">{r.reassessmentDays} days</span> — your next
          reassessment is due{' '}
          <span className="font-semibold">{dateFormatted}</span>.
        </p>
      </div>

      {/* disclaimer */}
      <p className="text-[11px] text-ink-2 leading-relaxed">{r.disclaimer}</p>
    </footer>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function WellnessReport() {
  const r = report
  const { snapshot, triage, groups, strengths } = r

  return (
    <div>
      {/* Hero */}
      <section className="mb-6">
        <p className="text-[11px] tracking-[.07em] uppercase text-ink-2 mb-1">
          Your wellness snapshot
        </p>
        <h1 className="font-serif text-[30px] font-medium text-ink leading-snug">
          {snapshot.headline}
        </h1>
        <p className="text-[14px] text-ink-2 mt-1 mb-0 leading-relaxed">
          {snapshot.subhead}
        </p>
      </section>

      {/* All body systems */}
      <SystemsGarden counts={snapshot.counts} />

      {/* Triage banner */}
      {triage && <TriageBanner triage={triage} />}

      {/* Finding groups */}
      {groups.map(g => <Group key={g.id} g={g} />)}

      {/* Strengths */}
      <Strengths strengths={strengths} />

      {/* Footer — no pillars line */}
      <Footer r={r} />
    </div>
  )
}
