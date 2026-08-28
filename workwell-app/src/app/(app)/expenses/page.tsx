import { redirect } from 'next/navigation'

/** Claims are now a tab of the pay page. Kept as a redirect so existing
 *  links — including the expense-decided notification HR sends — keep
 *  landing somewhere real. See trends/page.tsx. */
export default async function ExpensesMoved() {
  redirect('/payroll?tab=expenses')
}
