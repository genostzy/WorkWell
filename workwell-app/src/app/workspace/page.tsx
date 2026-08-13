import { Shell } from '@/components/shell'
import WorkspaceClient from './workspace-client'

export default function Workspace() {
  return (
    <Shell plane="private">
      <WorkspaceClient />
    </Shell>
  )
}
