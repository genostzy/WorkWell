import { Shell } from '@/components/shell'
import ExpensesClient from './expenses-client'

export default function Expenses() {
  return (
    <Shell plane="work">
      <ExpensesClient />
    </Shell>
  )
}
