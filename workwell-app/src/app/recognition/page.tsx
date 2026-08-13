import { Shell } from '@/components/shell'
import RecognitionClient from './recognition-client'

export default function Recognition() {
  return (
    <Shell plane="private">
      <RecognitionClient />
    </Shell>
  )
}
