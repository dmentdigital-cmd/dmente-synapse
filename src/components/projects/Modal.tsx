import { useEffect, useRef, type FormEvent, type ReactNode } from 'react'
import { AlertTriangle, X } from 'lucide-react'

type Props = { title: string; eyebrow?: string; busy: boolean; error?: string; submitLabel: string; danger?: boolean; narrow?: boolean; onClose: () => void; onSubmit: (data: FormData) => void; children: ReactNode }

/** Dialog shared by the project forms: focus stays inside, Escape closes, focus returns to the opener. */
export function Modal({ title, eyebrow, busy, error, submitLabel, danger, narrow, onClose, onSubmit, children }: Props) {
  const form = useRef<HTMLFormElement>(null)
  const state = useRef({ busy, onClose })
  state.current = { busy, onClose }

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const controls = () => Array.from(form.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)') ?? [])
    // A form opens on its first field; a bare confirmation opens on Cancel so Enter never deletes by accident.
    const initial = controls().find((control) => control.hasAttribute('data-autofocus')) ?? controls().find((control) => control.tagName !== 'BUTTON') ?? controls().find((control) => control.hasAttribute('data-cancel')) ?? controls()[0]
    initial?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !state.current.busy) { state.current.onClose(); return }
      if (event.key !== 'Tab') return
      const list = controls()
      if (!list.length) { event.preventDefault(); form.current?.focus(); return }
      const first = list[0], last = list[list.length - 1]
      if (!list.includes(document.activeElement as HTMLElement)) { event.preventDefault(); (event.shiftKey ? last : first).focus() }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); if (opener?.isConnected) opener.focus() }
  }, [])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!busy) onSubmit(new FormData(event.currentTarget))
  }

  return <div className="agenda-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose() }}>
    <form ref={form} tabIndex={-1} className={`agenda-create-form project-modal${narrow ? ' status-comment-modal' : ''}`} role={danger ? 'alertdialog' : 'dialog'} aria-modal="true" aria-labelledby="project-modal-title" onSubmit={submit}>
      <header><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h2 id="project-modal-title">{title}</h2></div><button type="button" className="icon-button" aria-label="Cerrar" disabled={busy} onClick={onClose}><X size={18} /></button></header>
      {children}
      {error && <div className="agenda-error" role="alert"><AlertTriangle size={15} />{error}</div>}
      <footer><button type="button" data-cancel className="agenda-cancel-create" disabled={busy} onClick={onClose}>Cancelar</button><button type="submit" className={danger ? 'agenda-delete-task' : 'agenda-save-create'} disabled={busy}>{busy ? 'Guardando…' : submitLabel}</button></footer>
    </form>
  </div>
}
