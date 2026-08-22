import { createClient } from '@/lib/supabase/server'
import { LoadError, PageHead, PlaneBadge, PrivacyNote } from '@/components/chrome'
import { Shell } from '@/components/shell'
import AttendanceClient from './attendance-client'

export default async function Attendance() {
  const supabase = await createClient()

  const [
    { data: me },
    { data: roles },
  ] = await Promise.all([
    supabase.from('me').select('id, full_name').maybeSingle(),
    supabase.from('person_roles').select('role'),
  ])

  const isHr = (roles ?? []).some((r) => r.role === 'hr')

  if (!me) {
    return (
      <Shell plane="work">
        <PageHead title="Attendance" />
        <PlaneBadge plane="work" />
        <LoadError what="Your attendance" />
      </Shell>
    )
  }

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const since = thirtyDaysAgo.toISOString().slice(0, 10)

  const [
    { data: myRecords, error: myError },
    { data: allRecords, error: allError },
    { data: people },
  ] = await Promise.all([
    supabase
      .from('attendance')
      .select('id, clock_in, clock_out, date, note')
      .eq('person_id', me.id)
      .gte('date', since)
      .order('date', { ascending: false }),
    isHr
      ? supabase
          .from('attendance')
          .select('id, person_id, clock_in, clock_out, date, note')
          .gte('date', since)
          .order('date', { ascending: false })
      : Promise.resolve({ data: null, error: null }),
    isHr
      ? supabase.from('people').select('id, full_name')
      : Promise.resolve({ data: null, error: null }),
  ])

  const readError = myError ?? allError
  if (readError) {
    return (
      <Shell plane="work">
        <PageHead title="Attendance" />
        <PlaneBadge plane="work" />
        <LoadError what="Your attendance" detail={readError.message} />
      </Shell>
    )
  }

  const today = new Date().toISOString().slice(0, 10)
  const todayRecord = (myRecords ?? []).find((r) => r.date === today) ?? null
  const history = (myRecords ?? []).filter((r) => r.date !== today)

  const names = new Map((people ?? []).map((p) => [p.id, p.full_name]))

  const todayAll = isHr ? (allRecords ?? []).filter((r) => r.date === today) : []
  const summary = isHr
    ? (people ?? []).map((p) => {
        const rec = todayAll.find((r) => r.person_id === p.id)
          return {
            id: p.id,
            name: p.full_name,
            clockedIn: rec ? !rec.clock_out : false,
            clock_in: rec?.clock_in ?? null,
            clock_out: rec?.clock_out ?? null,
          }
      })
    : []

  return (
    <Shell plane="work">
      <PageHead
        title="Attendance"
        lead="Clock in and out for the day. Your hours are visible to HR."
      />
      <PlaneBadge plane="work" />

      <PrivacyNote
        plane="work"
        detail="Attendance is work-plane data — clock-in and clock-out times are visible to HR. This is the opposite of the private plane: employment requires knowing when you were present, so this record lives where HR can see it."
      >
        <b>HR can see your clock-in/out times.</b>{' '}
      </PrivacyNote>

      <AttendanceClient
        todayRecord={todayRecord}
        history={history}
        isHr={isHr}
        todayAll={todayAll}
        names={names}
        summary={summary}
      />
    </Shell>
  )
}
