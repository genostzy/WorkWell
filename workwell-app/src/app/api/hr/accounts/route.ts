import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient, generatePassword } from '@/lib/supabase/admin'

/**
 * Creating accounts, and resetting a password.
 *
 * Both need Supabase's Admin API, which needs the service-role key, which
 * bypasses every RLS policy we have. So the first thing this route does —
 * before touching that key — is establish the caller is HR, using their own
 * session against the same `person_roles` view every HR page reads. The
 * database functions below check `is_hr()` again on their own account. The
 * key is powerful enough that one gate in front of it is not enough.
 *
 * Nothing here logs a generated password. Each is returned once, in the
 * response body, and never written down on this side.
 */

type AccountInput = {
  email?: string
  fullName?: string
  jobTitle?: string
  department?: string
  isHr?: boolean
}

type AccountResult = {
  email: string
  fullName: string
  password?: string
  error?: string
}

type Body = {
  action: 'create' | 'reset'
  personId?: string
  accounts?: AccountInput[]
}

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: claims } = await supabase.auth.getClaims()
  if (!claims) return fail('You are not signed in.', 401)

  const { data: roles, error: rolesError } = await supabase
    .from('person_roles')
    .select('role')

  // A read that failed is not a caller without the role, and treating it as
  // one would be a confusing 403. Treating it as a *pass* would be far
  // worse, so it is its own answer.
  if (rolesError) return fail('Could not check your access.', 500)
  if (!(roles ?? []).some((r) => r.role === 'hr'))
    return fail('Only HR can manage accounts.', 403)

  let body: Body
  try {
    body = await request.json()
  } catch {
    return fail('Malformed request.')
  }

  let admin
  try {
    admin = createAdminClient()
  } catch (e) {
    // The key being absent is a deployment problem, not the operator's
    // mistake — say which so nobody goes hunting through the form.
    return fail(e instanceof Error ? e.message : 'Admin access unavailable.', 500)
  }

  /* ------------------------------------------------------------- Reset */

  if (body.action === 'reset') {
    if (!body.personId) return fail('Which account?')

    // Flips must_change_password and hands back the auth id, in one
    // transaction, having checked HR and same-org itself.
    const { data: authId, error } = await supabase.rpc('begin_password_reset', {
      p_person_id: body.personId,
    })
    if (error) return fail(error.message)

    const password = generatePassword()
    const { error: updateError } = await admin.auth.admin.updateUserById(
      authId as string,
      { password }
    )
    // The flag is already true at this point. That is the safe way round:
    // an account flagged to change a password that did not change is a
    // nuisance, where the reverse would be a changed password nobody is
    // asked to replace.
    if (updateError) return fail(updateError.message, 502)

    return NextResponse.json({ password })
  }

  /* ------------------------------------------------------------ Create */

  if (body.action !== 'create') return fail('Unknown action.')

  const accounts = Array.isArray(body.accounts) ? body.accounts : []
  if (accounts.length === 0) return fail('Add at least one account.')

  // One bad row should not sink the rest of the batch — HR typing ten
  // people and having a typo in row 4 lose rows 5 through 10 too would be
  // a worse experience than a form that fails per-row and keeps going.
  const results: AccountResult[] = []

  for (const raw of accounts) {
    const email = (raw.email ?? '').trim().toLowerCase()
    const fullName = (raw.fullName ?? '').trim()

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      results.push({ email: raw.email ?? '', fullName, error: 'Not a valid email address.' })
      continue
    }
    if (!fullName) {
      results.push({ email, fullName, error: 'A name is required.' })
      continue
    }

    const password = generatePassword()

    // email_confirm: HR vouching for the address in person is the
    // confirmation. There is no inbox round-trip in this flow to do it.
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    let authUserId = created?.user?.id ?? null

    if (createError) {
      // An address can already have an auth account without having access —
      // anyone invited under an earlier flow has one. That is a reason to
      // adopt it, not to refuse: refusing would leave that person
      // permanently un-addable while their email looks free in the
      // directory.
      const alreadyExists =
        createError.status === 422 ||
        /already (been )?registered|already exists/i.test(createError.message)

      if (!alreadyExists) {
        results.push({ email, fullName, error: createError.message })
        continue
      }

      const { data: list, error: listError } = await admin.auth.admin.listUsers()
      if (listError) {
        results.push({ email, fullName, error: listError.message })
        continue
      }

      const existing = list.users.find((u) => (u.email ?? '').toLowerCase() === email)
      if (!existing) {
        results.push({ email, fullName, error: 'That address is taken but its account could not be found.' })
        continue
      }

      const { error: pwError } = await admin.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
      })
      if (pwError) {
        results.push({ email, fullName, error: pwError.message })
        continue
      }
      authUserId = existing.id
    }

    if (!authUserId) {
      results.push({ email, fullName, error: 'The account was not created.' })
      continue
    }

    const { error: provisionError } = await supabase.rpc('provision_person', {
      p_auth_user_id: authUserId,
      p_full_name: fullName,
      p_job_title: raw.jobTitle ?? null,
      p_department: raw.department ?? null,
      p_is_hr: raw.isHr ?? false,
    })

    if (provisionError) {
      // The auth user exists but has no person record. That is the
      // product's existing "signed in, no access" state rather than a new
      // kind of broken, and it is recoverable: creating the account again
      // adopts this same auth user by the branch above.
      results.push({
        email,
        fullName,
        error: `Signed in was created but not linked to a person: ${provisionError.message}. Creating it again will pick it up.`,
      })
      continue
    }

    results.push({ email, fullName, password })
  }

  return NextResponse.json({ results })
}
