/**
 * Why this file exists at all: entry animations.
 *
 * The shell — sidebar, topbar, and the `<main className="content">` box
 * itself — is rendered by this group's layout.tsx, and a layout deliberately
 * persists across navigations. React therefore reconciles the existing DOM
 * on a route change rather than rebuilding it, and reuses whatever nodes
 * line up by type and position. Two pages that both open with a PageHead and
 * a stack of cards line up almost exactly.
 *
 * A CSS animation runs when its element is *created*. Reused nodes are never
 * created again, so `card-in`, `fade-up`, `pop-in` and friends fired once on
 * the first paint of the session and then never again — the app animated
 * beautifully on load and went flat the moment you navigated.
 *
 * A template renders between the layout and its children and is given a key
 * per segment, so its subtree is genuinely remounted and, in Next's own
 * words, "DOM elements inside the template are fully recreated". That is the
 * whole fix: new nodes, so the animations play on every navigation.
 *
 * It stays a Fragment on purpose. `.content > * + *` is what puts a floor of
 * spacing between whatever a page stacks up, and that selector matches
 * *direct* children — wrapping them in a div here would collapse every
 * page's vertical rhythm into a single child and undo it.
 *
 * The `.content` box's own `content-enter` still runs only on first load,
 * since that element belongs to the layout rather than to this subtree.
 * Leaving it that way is deliberate: what reads as a page transition is the
 * cards and headings arriving, and those are back.
 */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
