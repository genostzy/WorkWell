import { Shell } from '@/components/shell'
import CheckInClient from './check-in-client'

export default function CheckIn() {
  return (
    <Shell current="check-in">
      <CheckInClient />
    </Shell>
  )
}
