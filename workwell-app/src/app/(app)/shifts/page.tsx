import { redirect } from 'next/navigation'

/** The roster is now a tab of the attendance page. Kept as a redirect so
 *  existing links keep landing somewhere real — see trends/page.tsx. */
export default async function ShiftsMoved() {
  redirect('/attendance?tab=shifts')
}
