import { SignInRoom } from '@/components/sign-in-room'

/**
 * Reaching this page is always deliberate — a direct visit, or a redirect
 * from a guarded route — so the sheet is already up rather than asking for
 * a second click on the door. The locked office stands behind it either
 * way, so the page is recognisably the same place you are signing in to.
 */
export default function SignIn() {
  return <SignInRoom openOnLoad />
}
