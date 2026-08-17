import { Shell } from '@/components/shell'
import PayrollClient from './payroll-client'

export default function Payroll() {
  return (
    <Shell plane="work">
      <PayrollClient />
    </Shell>
  )
}
