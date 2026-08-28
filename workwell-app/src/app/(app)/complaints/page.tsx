import { redirect } from 'next/navigation'

/** Now a tab of the cases page. Kept as a redirect so existing links keep
 *  landing somewhere real — see trends/page.tsx. */
export default async function Moved() {
  redirect('/cases?tab=complaints')
}
