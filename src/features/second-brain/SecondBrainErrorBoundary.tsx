import { Component, type ReactNode } from 'react'

export class SecondBrainErrorBoundary extends Component<{ children: ReactNode; onClose: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (!this.state.failed) return this.props.children
    return <section className="operational-agenda" role="alert"><h1>No se pudo mostrar el segundo cerebro</h1><p>Puedes reintentar la vista o volver a la oficina.</p><button type="button" className="agenda-new-task" onClick={() => this.setState({ failed: false })}>Reintentar</button><button type="button" className="agenda-close" onClick={this.props.onClose}>Volver a la oficina</button></section>
  }
}
