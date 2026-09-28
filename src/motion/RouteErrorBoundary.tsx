import { Component, type ReactNode } from 'react'
/** Lazy-route failure stays readable after the preparation gate is released. */
export class RouteErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (!this.state.failed) return this.props.children
    return <main className="grid min-h-dvh place-content-center gap-4 bg-ink p-6 text-paper" role="alert">
      <h1 className="font-display text-4xl">Red Tide could not open this page</h1>
      <p>Check your connection and reload to try again.</p>
      <button className="rounded-lg bg-accent px-5 py-3 font-semibold text-ink" onClick={() => window.location.reload()}>Reload page</button>
    </main>
  }
}
