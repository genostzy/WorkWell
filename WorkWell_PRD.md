# WorkWell — Product Requirements Document

**Version 2.0 · 6 August 2026 · Draft**

---

## 1. Title / Summary

WorkWell is an employee wellbeing platform with two separate planes: a
**Private Plane** only the employee can see, and an **Organizational Plane**
showing leadership anonymous patterns for groups of 8 or more people.

Employees can be honest because the employer cannot read their data. Leaders
see where workload is too heavy, without seeing individuals.

---

## 2. Problem Statement

- Burnout is invisible until someone resigns or goes on leave.
- Annual surveys are too infrequent and suffer low participation.
- If the employer can see individual wellbeing data, employees give the safe
  answer instead of the true one — so the data becomes worthless.
- Tracking individual activity creates a record of unpaid overtime and legal risk.
- Burnout is mostly caused by staffing and workload, not by individuals coping badly.

**Why now:** hybrid work removed the informal signals managers relied on, and
right-to-disconnect laws are making after-hours activity logs a liability.

---

## 3. Goals & Success Metrics

### Goals

1. Employees notice their own strain earlier.
2. Employees trust the tool enough to answer honestly.
3. Leadership can find overloaded groups and fix staffing or workload.
4. No individual is ever identified, scored, or ranked.

### Metrics

| Metric | Target |
|---|---|
| Check-in completion rate (group aggregate) | 45% weekly |
| Median check-in time | 10 seconds or less |
| "I believe my employer cannot see my entries" | 80% agree |
| Groups where leadership took a documented action | 1 per flagged group per quarter |
| Reduction in after-hours activity where quiet hours adopted | 15% |
| Privacy incidents (individual data reaching org plane) | **0 — release blocker** |

**Rule:** no metric may read an individual's private data. Adoption is measured
as anonymous group aggregates using the same 8-person rule as the product.

**We will not optimise for:** daily active users, streaks, or nudge acceptance.
Those push the product toward nagging.

---

## 4. Non-Goals

WorkWell will **not**:

1. Diagnose mental health conditions.
2. Calculate a wellbeing score, burnout risk score, or ranking.
3. Let managers, HR, or admins see individual wellbeing data.
4. Predict resignation.
5. Monitor employees secretly.
6. Show Boundary Assistant activity to the employer.
7. Flag anyone as "at risk".
8. Estimate or blur a metric for a group under 8 — it is hidden completely.

**Changed from v1:** the Burnout Predictor and its two scores were removed.
Burnout has no validated training label, so any score is a guess presented as a
measurement — and an employer holding a risk score creates legal exposure while
destroying the honest answers the score depends on.

**Out of scope for v2.0:** admin console, integration setup UI, native mobile
apps, AI coaching, languages beyond English.

---

## 5. User Stories

### Employee

- I want to see my own patterns over time, so I notice strain before it becomes a crisis.
- I want to record how I feel without my employer seeing it, so I can be honest.
- I want the tool to say "not enough data yet" rather than guess.
- I want to set my own working hours, because I work shifts / a different time zone.
- I want to send messages late without pressuring colleagues.
- I want reminders that don't interrupt me at bad moments.
- I want to reduce visual and notification load, because busy screens are hard for me.
- I want to ask HR for support privately, on my own terms.

### HR Leader / Manager

- I want to see which groups carry too much load, so I can fix staffing.
- I want confidence that nothing I see identifies a person.
- I want to filter by team and date, and have the 8-person rule re-checked.
- I want to know when a signal is not yet trustworthy.

### Administrator

- I want to configure SSO and roles, and prove access through audit logs.
- I must **not** be able to read private-plane data, even as an admin.

---

## 6. Requirements

### Functional

| # | Feature | Must do |
|---|---|---|
| F1 | Personal Trend Reflection | Build a baseline from the person's own history. Explain changes in plain language with a suggested action. Say "not enough data yet" rather than guess. Never produce a score |
| F2 | Private Mood Check | Complete in 10 seconds. Emoji, slider, or word input. Every question skippable |
| F3 | Adaptive Health Nudges | Opt-in, rate-limited, silenced during leave, focus time and meetings. One-tap mute for the day |
| F4 | Boundary Assistant | User-defined quiet hours and working window. Delayed sending. No after-hours record reaches the employer |
| F5 | Recognition & Support | Peer appreciation, virtual coffee, private HR/EAP request. No counting or leaderboards |
| F6 | Adaptive Workspace | Focus mode, theme, contrast, motion, notification density, alternative input formats |
| F7 | Structural Load Diagnostics | Five group metrics: working hours, meeting load, after-hours activity, time-off usage, workload patterns. Only for groups of 8+ |

### Non-functional

- **Performance:** dashboard under 3s, check-in saved under 500ms, aggregation under 10s.
- **Security:** encrypted in transit and at rest. The two planes use **separate
  storage and access layers** — the org service holds no credential that can
  read private data.
- **The 8-person rule is enforced server-side**, before data leaves the
  aggregation layer. Never in the browser.
- **Scalability:** multi-tenant, 50,000 employees per tenant, 99.5% uptime.
- **Offline:** check-ins save locally and sync later.
- **Accessibility:** WCAG 2.1 AA. Keyboard operable. Colour is never the only
  signal — plane identity also carries an icon and a label. Adjustable density,
  contrast, and motion.
- **Compliance:** GDPR. DPIA before EU launch. Works council consultation where required.

---

## 7. User Flows

Working screens exist for every flow. Open `workwell-prototype/index.html`.
Add `?state=empty` to any screen to see its other states.

| Flow | Steps | Screen |
|---|---|---|
| Onboarding | Privacy explainer → choose signals → choose format → reminders → working hours | `onboarding.html` |
| Daily check-in | Mood → energy → pressure → workload + note → saved | `check-in.html` |
| Trend reflection | Summary tiles → trend chart → "what changed" cards → other metrics | `trends.html` |
| Boundaries | Set quiet hours → delayed sending → focus protection | `boundary.html` |
| Support request | Choose topic → write → send to HR or EAP → withdrawable | `recognition.html` |
| Org diagnostics | Roll-up → five metrics → filter → groups re-checked and hidden | `org-diagnostics.html` |

The privacy explainer comes **first** in onboarding: we say what the employer
can see before we ask for anything.

---

## 8. Edge Cases & Error States

| Situation | What happens |
|---|---|
| Group has fewer than 8 people | Hidden completely. Named, with the reason. No value, no chart, no estimate |
| A filter drops a group below 8 | Re-hidden immediately, and we say that narrowing hid more groups |
| Every group in the selection is under 8 | Nothing renders anywhere on the page |
| Group of exactly 8 | Shown. The rule is 8 or more |
| Aggregation job fails halfway | Show nothing. A partial result can break the 8-person rule invisibly |
| Under 2 weeks of personal data | "Not enough data yet." Show entries, draw no trend |
| Under 6 weeks of org history | No trends. Current figures only |
| Employee returns from long leave | Exclude the leave period. Don't read the gap as a change |
| Offline at check-in | Save locally, sync later, say so |
| Trends fail to load | Explain the failure, confirm history is safe, offer retry |
| Delayed-send service down | Hold messages locally and deliver on reconnect |
| Employee never checks in | No consequence. Nobody is told |
| Manager asks for individual data | No mechanism exists |
| Company has under 8 staff total | Org plane shows nothing at all |
| Shift worker crossing midnight | Working window may span midnight |

---

## 9. Dependencies

| Dependency | Needed for | Risk |
|---|---|---|
| Data platform | Aggregation and the 8-person rule | **High** — this is where privacy is enforced |
| Security | Plane separation review, penetration test | **High** — the core claim is a security claim |
| Legal / DPO | DPIA, retention, works council packs | **High** — blocks EU launch |
| Identity / SSO | Login and role provisioning | Medium |
| HRIS (e.g. Workday) | Org structure, leave calendar, headcount | **High** — groups are defined from it |
| Google Calendar / Microsoft Graph / Slack | Meeting load, after-hours rates, delayed send | Medium |
| EAP vendor | Support request routing | Medium |
| Leadership commitment to act | The whole point | **High** — a dashboard nobody acts on is theatre |

---

## 10. Timeline & Milestones

| Milestone | Target | Done when |
|---|---|---|
| M0 — Design complete | Aug 2026 ✅ | Screens, states, design system delivered |
| M1 — Architecture & privacy review | Sep 2026 | Plane separation signed off by Security and DPO |
| M2 — Private plane alpha | Nov 2026 | Check-in, onboarding, trends. 50 internal users |
| M3 — Boundaries & nudges | Dec 2026 | Quiet hours, delayed send, integrations live |
| M4 — Org plane alpha | Jan 2027 | Five metrics, filters, penetration test on re-identification |
| M5 — Accessibility & privacy audit | Feb 2027 | WCAG 2.1 AA verified. Independent privacy audit passed |
| M6 — Design partner beta | Mar 2027 | 2–3 customers, 500+ employees each |
| M7 — General availability | Jun 2027 | Zero privacy incidents. Trust metric at 80% |

**Critical path:** M1 → M4 → M5 → M7. If the re-identification test fails at
M4, the org plane has to be redesigned.

---

## 11. Open Questions

| # | Question | Owner | Needed by |
|---|---|---|---|
| Q1 | **Subtraction attack.** If we show an org total next to group values, a hidden group can be worked out by subtracting. Do we hide extra groups, add noise, or drop totals? | Data + Security | M4 |
| Q2 | Is 8 enough? Some works councils want 10+. Should it be configurable upward per customer? | Legal / DPO | M1 |
| Q3 | What counts as a "contributing member"? Any activity, or a minimum? This decides how often short date ranges hide groups | Product + Data | M4 |
| Q4 | How long do we keep private-plane data, and does the employee control it? | Legal + Product | M2 |
| Q5 | Do we sell the org plane in year one, or launch private-only first to build trust? | Leadership | M6 |
| Q6 | Should managers see their own team, or only HR see the org view? A manager seeing their team may create pressure | Product + Legal | M4 |
| Q7 | What happens when leadership ignores a flagged group? | Product | M6 |
| Q8 | Are passive signals opt-in or opt-out? Opting out shrinks groups and hides more of them | Legal + Product | M2 |

---

## Appendix — Source documents

| Document | Role |
|---|---|
| WorkWell_Revised_v2.txt | Two-plane solution. Authoritative on scope |
| WorkWell_Product_Requirements_Document.docx | PRD v1. Superseded |
| WorkWell (untitled draft) | v1 Burnout Predictor. Obsolete — scoring rejected |
| WorkWell_HiFi_Design_Plan.md | Design plan and screen inventory |
| workwell-prototype/ | Working screens for every flow and state |
