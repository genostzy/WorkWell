import { Shell } from '@/components/shell'
import AttendanceClient from './attendance-client'

export default function Attendance() {
  return (
    <Shell plane="work">
      <AttendanceClient />
    </Shell>
  )
}
