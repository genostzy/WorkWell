import { createClient } from '@/lib/supabase/server'
import { readIsHr } from '@/lib/role'
import { LoadError, PageHead } from '@/components/chrome'
import NewsClient from '../../news/news-client'
import { NewsManageClient } from '../../news/news-manage-client'

export default async function News() {
  const supabase = await createClient()
  const { isHr, error } = await readIsHr(supabase)

  if (error) {
    return (
      <>
        <PageHead title="News" />
        <LoadError what="Your account" detail={error} />
      </>
    )
  }

  return isHr ? <NewsManageClient /> : <NewsClient />
}
