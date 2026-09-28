import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, ArrowLeft, RotateCcw } from 'lucide-react'

type Props = { children: ReactNode; onClose: () => void }
type State = { failed: boolean }

export class AgendaErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('No se pudo renderizar la Agenda Operativa', error, info)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return <section className="operational-agenda agenda-fallback" aria-label="Error de Agenda Operativa">
      <AlertTriangle size={28} />
      <h1>No pudimos mostrar la agenda</h1>
      <p>Hay un registro que necesita revisión. La oficina continúa disponible.</p>
      <div>
        <button type="button" className="agenda-new-task" onClick={() => this.setState({ failed: false })}><RotateCcw size={15} />Reintentar</button>
        <button type="button" className="agenda-close" onClick={this.props.onClose}><ArrowLeft size={15} />Volver a oficina</button>
      </div>
    </section>
  }
}
