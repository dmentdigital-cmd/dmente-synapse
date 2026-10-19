import { Component, type ReactNode } from 'react'

export class LifeDashboardErrorBoundary extends Component<{ children: ReactNode; onClose: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (!this.state.failed) return this.props.children
    return <section className="operational-agenda" role="alert"><h1>No se pudo mostrar el Panel Diario</h1><p>La vista no está disponible. Puedes volver a la oficina y abrir la agenda.</p><button type="button" className="agenda-new-task" onClick={() => this.setState({ failed: false })}>Reintentar</button><button type="button" className="agenda-close" onClick={this.props.onClose}>Volver a la oficina</button></section>
  }
}
