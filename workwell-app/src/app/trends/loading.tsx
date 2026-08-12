import { ScreenSkeleton } from '@/components/skeleton'

export default function Loading() {
  return <ScreenSkeleton current="trends" plane="private" cards={2} />
}
