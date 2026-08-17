import Link from 'next/link'
import { PageHead, PlaneBadge } from '@/components/chrome'

type Feature = { href: string; icon: string; title: string; desc: string }

const FEATURES: Feature[] = [
  { href: '/org', icon: '📊', title: 'Structural load', desc: 'Anonymous group patterns. Never a person.' },
  { href: '/hr', icon: '🗂️', title: 'People', desc: 'Employment records, leave decisions, the directory.' },
  { href: '/hr/accounts', icon: '🔑', title: 'Accounts', desc: 'Who can sign in, and what they can open.' },
  { href: '/letter-heads', icon: '📄', title: 'Letter heads', desc: 'Generate offer letters and certificates.' },
  { href: '/custom-fields', icon: '🧩', title: 'Data fields', desc: 'Extra fields on an employment record.' },
  { href: '/offboarding', icon: '🚪', title: 'Offboarding', desc: "The checklist for someone leaving." },
  { href: '/warnings', icon: '⚠️', title: 'Warnings', desc: 'Formal disciplinary records.' },
]

/**
 * The whole of an HR/admin account's plane, laid out as one dashboard
 * rather than scattered through the office. There is no office here — an
 * HR/admin account holds no private plane to walk around in, so a picture
 * of a room would be a picture of nothing this account owns.
 */
export function AdminDashboard({ name }: { name: string }) {
  return (
    <>
      <PageHead
        title="Administration"
        lead={`Signed in as ${name}. Everything this account can open — nothing more.`}
      />
      <PlaneBadge plane="work" />

      <div className="grid grid--3">
        {FEATURES.map((f) => (
          <Link key={f.href} href={f.href} className="card">
            <div className="state__icon" aria-hidden="true" style={{ fontSize: 'var(--fs-hero)', marginBottom: 'var(--s-2)' }}>
              {f.icon}
            </div>
            <div className="card__title">{f.title}</div>
            <p className="card__sub mt-1">{f.desc}</p>
          </Link>
        ))}
      </div>
    </>
  )
}
