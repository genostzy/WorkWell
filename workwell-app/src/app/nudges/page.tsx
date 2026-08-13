import { Shell } from '@/components/shell'
import NudgesClient from './nudges-client'

export default function Nudges() {
  return (
    <Shell plane="private">
      <NudgesClient />
    </Shell>
  )
}
