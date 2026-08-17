import { Shell } from '@/components/shell'
import ComplaintsClient from './complaints-client'

export default function Complaints() {
  return (
    <Shell plane="work">
      <ComplaintsClient />
    </Shell>
  )
}
