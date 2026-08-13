import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient, generatePassword } from '@/lib/supabase/admin'

/**
 * Creating an account, and resetting a password.
 *
 * Both need Supabase's Admin API, which needs the service-role key, which
 * bypasses every RLS policy we have. So the first thing this route does —
 * before touching that key — is establish the caller is HR, using their own
 * session against the same `person_roles` view every HR page reads. The
 * database functions below check `is_hr()` again on their own account. The
 * key is powerful enough that one gate in front of it is not enough.
 *
 * Nothing here logs the generated password. It is returned once, in the
 * response body, and never written down on this side.
 */

type Body = {
  action: 'create' | 'reset'
  personId?: string
  email?: string
  fullName?: string
  jobTitle?: string
  department?: string
  isHr?: boolean
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

  const email = (body.email ?? '').trim().toLowerCase()
  const fullName = (body.fullName ?? '').trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return fail('That does not look like an email address.')
  if (!fullName) return fail('A name is required.')

  const password = generatePassword()

  // email_confirm: HR vouching for the address in person is the
  // confirmation. There is no inbox round-trip in this flow to do it.
  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

  let authUserId = created?.user?.id ?? null

  if (createError) {
    // An address can already have an auth account without having access —
    // anyone who signed in under the old magic-link flow has one. That is a
    // reason to adopt it, not to refuse: refusing would leave those people
    // permanently un-addable while their email looks free in the directory.
    const alreadyExists =
      createError.status === 422 ||
      /already (been )?registered|already exists/i.test(createError.message)

    if (!alreadyExists) return fail(createError.message, 502)

    const { data: list, error: listError } = await admin.auth.admin.listUsers()
    if (listError) return fail(listError.message, 502)

    const existing = list.users.find(
      (u) => (u.email ?? '').toLowerCase() === email
    )
    if (!existing)
      return fail('That address is taken but its account could not be found.', 502)

    const { error: pwError } = await admin.auth.admin.updateUserById(
      existing.id,
      { password, email_confirm: true }
    )
    if (pwError) return fail(pwError.message, 502)
    authUserId = existing.id
  }

  if (!authUserId) return fail('The account was not created.', 502)

  const { error: provisionError } = await supabase.rpc('provision_person', {
    p_auth_user_id: authUserId,
    p_full_name: fullName,
    p_job_title: body.jobTitle ?? null,
    p_department: body.department ?? null,
    p_is_hr: body.isHr ?? false,
  })

  if (provisionError) {
    // The auth user exists but has no person record. That is the product's
    // existing "signed in, no access" state rather than a new kind of
    // broken, and it is recoverable: creating the account again adopts this
    // same auth user by the branch above. Saying so beats a silent retry
    // that could double-create.
    return fail(
      `The sign-in was created but the person record was not: ${provisionError.message}. ` +
        'Creating the account again with the same email will pick it up.',
      500
    )
  }

  return NextResponse.json({ password })
}
