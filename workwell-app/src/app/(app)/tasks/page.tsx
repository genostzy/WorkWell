import { createClient } from '@/lib/supabase/server'
import { readIsHr } from '@/lib/role'
import { LoadError, PageHead } from '@/components/chrome'
import TasksClient from '../../tasks/tasks-client'
import AssignTasksClient from '../../tasks/assign-tasks-client'

/**
 * One route, two screens, because the two roles want opposite halves of
 * the same thing: an employee wants their own list plus what they were
 * given, and HR wants to set tasks and watch them land. Neither is a
 * filtered view of the other, so neither is built as one — the same shape
 * as holidays, payroll and warnings already use here.
 */
export default async function Tasks() {
  const supabase = await createClient()
  const { isHr, error } = await readIsHr(supabase)

  if (error) {
    return (
      <>
        <PageHead title="Tasks" />
        <LoadError what="Your account" detail={error} />
      </>
    )
  }

  return isHr ? <AssignTasksClient /> : <TasksClient />
}
