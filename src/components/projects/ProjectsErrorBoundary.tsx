import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, ArrowLeft, RotateCcw } from 'lucide-react'

type BoundaryProps = { children: ReactNode; onClose: () => void }

export class ProjectsErrorBoundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('No se pudo renderizar Proyectos', error, info) }
  render() {
    if (!this.state.failed) return this.props.children
    return <section className="operational-agenda agenda-fallback" aria-label="Error de Proyectos">
      <AlertTriangle size={28} />
      <h1>No pudimos mostrar los proyectos</h1>
      <p>Hay un registro que necesita revisión. La oficina y la agenda continúan disponibles.</p>
      <div>
        <button type="button" className="agenda-new-task" onClick={() => this.setState({ failed: false })}><RotateCcw size={15} />Reintentar</button>
        <button type="button" className="agenda-close" onClick={this.props.onClose}><ArrowLeft size={15} />Volver a oficina</button>
      </div>
    </section>
  }
}
