import { ContentSkeleton } from '@/components/content-skeleton'

/**
 * Content-area skeleton only. The Shell (sidebar + topbar) persists from
 * the layout — this loading state replaces only the children slot.
 */
export default function Loading() {
  return <ContentSkeleton cards={2} />
}
