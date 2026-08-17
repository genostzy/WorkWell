import { Shell } from '@/components/shell'
import ResignationsClient from './resignations-client'

export default function Resignations() {
  return (
    <Shell plane="work">
      <ResignationsClient />
    </Shell>
  )
}
