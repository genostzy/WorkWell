import { redirect } from 'next/navigation'

/** The calendar is now a tab of the attendance page. Kept as a redirect so
 *  existing links keep landing somewhere real — see trends/page.tsx. */
export default async function HolidaysMoved() {
  redirect('/attendance?tab=holidays')
}
