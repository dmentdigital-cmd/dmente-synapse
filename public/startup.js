/* Runs independently of the React bundle so a failed module cannot hide recovery. */
(() => {
  const reloadKey = 'synapse-startup-reload-v1'
  const root = () => document.getElementById('root')
  const hasApplication = () => Boolean(root()?.children.length && !root().querySelector('[data-synapse-startup]'))
  let recoveryRunning = false

  function navigateFresh() {
    const url = new URL(window.location.href)
    url.searchParams.set('synapse-refresh', String(Date.now()))
    window.location.replace(url.href)
  }

  // A worker update or unavailable browser storage must not trap the retry button.
  async function bounded(operation) {
    let timer
    try {
      await Promise.race([operation(), new Promise(resolve => { timer = window.setTimeout(resolve, 1500) })])
    } catch { /* Continue to the fresh navigation even if a browser API fails. */ }
    finally { window.clearTimeout(timer) }
  }

  async function clearShellCaches() {
    if (!('caches' in window)) return
    const keys = await caches.keys()
    await Promise.all(keys.filter(key => key.startsWith('dmente-synapse-shell-')).map(key => caches.delete(key)))
  }

  function reloadOnce() {
    if (hasApplication()) return
    try {
      if (sessionStorage.getItem(reloadKey)) return
      sessionStorage.setItem(reloadKey, '1')
    } catch { return }
    navigateFresh()
  }

  async function recover(automatic) {
    if (recoveryRunning) return
    recoveryRunning = true
    await bounded(clearShellCaches)
    await bounded(async () => {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration('/')
        await registration?.update()
      }
    })
    if (automatic) reloadOnce()
    else navigateFresh()
    recoveryRunning = false
  }

  function showRecovery() {
    const container = root()
    if (!container || hasApplication()) return
    const panel = document.createElement('main')
    panel.setAttribute('data-synapse-startup', '')
    panel.setAttribute('role', 'alert')
    panel.style.cssText = 'max-width:560px;margin:12vh auto;padding:28px;color:#edf5fc;background:#081923;border:1px solid #294b5b;border-radius:14px;font-family:system-ui,sans-serif;line-height:1.6'
    const title = document.createElement('h1')
    title.textContent = 'No se pudo completar el inicio'
    const message = document.createElement('p')
    message.textContent = 'Puedes actualizar los archivos de la aplicación y volver a intentarlo. Tu cuenta y tus documentos no se borrarán.'
    const retry = document.createElement('button')
    retry.type = 'button'
    retry.textContent = 'Actualizar y reintentar'
    retry.style.cssText = 'padding:12px 18px;border:0;border-radius:8px;background:#64d9ff;color:#081923;font:inherit;cursor:pointer'
    retry.addEventListener('click', () => { retry.disabled = true; void recover(false) })
    panel.append(title, message, retry)
    container.replaceChildren(panel)
    void recover(true)
  }

  window.addEventListener('error', event => {
    if (event.target instanceof HTMLScriptElement || event.target === window) window.setTimeout(showRecovery, 0)
  }, true)
  window.addEventListener('unhandledrejection', () => window.setTimeout(showRecovery, 0))
  // Also repairs the update button of an older React bundle already on screen.
  window.addEventListener('click', event => {
    const button = event.target?.closest?.('.update-notice button')
    if (!button) return
    event.preventDefault()
    event.stopImmediatePropagation()
    button.disabled = true
    button.textContent = 'Actualizando…'
    void recover(false)
  }, true)
  window.setTimeout(showRecovery, 10000)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', reloadOnce)
    void navigator.serviceWorker.register('/sw.js?v=4', { updateViaCache: 'none' }).then(registration => registration.update()).catch(() => undefined)
  }
})()
