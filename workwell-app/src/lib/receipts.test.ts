import { describe, expect, it, vi } from 'vitest'
import { RECEIPTS_BUCKET, signReceipts } from './receipts'

/** A stand-in for the storage half of a Supabase client, recording what it
 *  was asked for so the batching can be asserted rather than assumed. */
function fakeStorage(rows: { path: string | null; signedUrl: string | null }[]) {
  const createSignedUrls = vi.fn(async () => ({ data: rows }))
  const from = vi.fn(() => ({ createSignedUrls }))
  return { client: { storage: { from } }, from, createSignedUrls }
}

describe('signReceipts', () => {
  it('maps each path to its signed URL', async () => {
    const { client } = fakeStorage([
      { path: 'p1/e1', signedUrl: 'https://signed/one' },
      { path: 'p1/e2', signedUrl: 'https://signed/two' },
    ])
    const map = await signReceipts(client, ['p1/e1', 'p1/e2'])
    expect(map.get('p1/e1')).toBe('https://signed/one')
    expect(map.get('p1/e2')).toBe('https://signed/two')
  })

  it('signs the whole list in one request, not one per row', async () => {
    const { client, createSignedUrls, from } = fakeStorage([])
    await signReceipts(client, ['p1/e1', 'p1/e2', 'p1/e3'])
    expect(createSignedUrls).toHaveBeenCalledTimes(1)
    expect(from).toHaveBeenCalledWith(RECEIPTS_BUCKET)
  })

  it('asks for nothing at all when no claim has a receipt', async () => {
    const { client, createSignedUrls } = fakeStorage([])
    const map = await signReceipts(client, [null, undefined, null])
    expect(createSignedUrls).not.toHaveBeenCalled()
    expect(map.size).toBe(0)
  })

  it('drops the nulls and asks for each path once', async () => {
    const { client, createSignedUrls } = fakeStorage([])
    await signReceipts(client, ['p1/e1', null, 'p1/e1', undefined])
    expect(createSignedUrls).toHaveBeenCalledWith(['p1/e1'], expect.any(Number))
  })

  // One receipt that cannot be signed costs that row its link. It must not
  // cost the other rows theirs, and it must not throw the page's render.
  it('keeps the rows that signed when one of them fails', async () => {
    const { client } = fakeStorage([
      { path: 'p1/e1', signedUrl: 'https://signed/one' },
      { path: 'p1/e2', signedUrl: null },
    ])
    const map = await signReceipts(client, ['p1/e1', 'p1/e2'])
    expect(map.get('p1/e1')).toBe('https://signed/one')
    expect(map.has('p1/e2')).toBe(false)
  })

  it('returns an empty map rather than throwing when the call returns nothing', async () => {
    const createSignedUrls = vi.fn(async () => ({ data: null }))
    const client = { storage: { from: () => ({ createSignedUrls }) } }
    await expect(signReceipts(client, ['p1/e1'])).resolves.toEqual(new Map())
  })
})
