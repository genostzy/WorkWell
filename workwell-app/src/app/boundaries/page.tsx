import { Shell } from '@/components/shell'
import BoundariesClient from './boundaries-client'

export default function Boundaries() {
  return (
    <Shell plane="private">
      <BoundariesClient />
    </Shell>
  )
}
