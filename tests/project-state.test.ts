import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isProjectStateFile, parseProjectState, repairEncoding } from '../server/project-state.js'

const template = `# Estado del Proyecto - Dmente Digital

**Fecha de Creación:** 2026-09-19  
**Última Actualización:** 2026-09-19

## 📊 RESUMEN EJECUTIVO

**Estado General:** En desarrollo activo  
**Progreso:** 50%

## ✅ QUÉ SE HA IMPLEMENTADO

### Completado
- **Landing** publicada
  - detalle anidado que no cuenta
- [x] Dominio configurado

### En Progreso
1. Integración con [n8n](https://example.com)

### Pendiente
- [ ] Pruebas en móvil

## 📁 ESTRUCTURA DEL PROYECTO
- carpeta que no es un pendiente

## 🚀 PRÓXIMOS PASOS

### Inmediato (Esta semana)
- Grabar el video

### Corto Plazo (1-2 semanas)
- Enviar propuesta

## 📌 NOTAS IMPORTANTES
- nota suelta

**Última actualización:** 2026-10-01
`

test('reads the shared ideas out of the emoji template', () => {
  const state = parseProjectState(template)
  assert.equal(state.title, 'Dmente Digital')
  assert.equal(state.generalStatus, 'En desarrollo activo')
  assert.equal(state.progress, 50)
  assert.equal(state.updatedLabel, '2026-10-01')
  assert.deepEqual(state.sections, { completed: ['Landing publicada', 'Dominio configurado'], inProgress: ['Integración con n8n'], pending: ['Pruebas en móvil'], nextSteps: ['Grabar el video', 'Enviar propuesta'] })
  assert.equal(state.projectId, null)
})

test('reads the Synapse block and ignores empty blockers', () => {
  const state = parseProjectState(`# Estado del Proyecto : DMENTE SYNAPSE\n\n**Última actualización:** 2026-10-04 16:42 (America/Bogota)\n**Estado general:** Despliegue en curso.\n\n## En progreso\n\n- Integración de leads\n\n## Pendiente\n\n- Prueba de aceptación\n\n## Próximos pasos\n\n1. Verificar cronjob\n\n## Synapse\n\nprojectId: dmente-synapse\nsourceDriveFolder: https://drive.google.com/drive/folders/abc\nobsidianNote:\nbloqueoPrincipal: Falta confirmar el despliegue.\nproximaAccion: Probar la reprogramación en producción.\nrequiereAprobacion: no\n`)
  assert.equal(state.title, 'DMENTE SYNAPSE')
  assert.equal(state.projectId, 'dmente-synapse')
  assert.equal(state.mainBlocker, 'Falta confirmar el despliegue.')
  assert.equal(state.nextAction, 'Probar la reprogramación en producción.')
  assert.equal(state.sourceDriveFolder, 'https://drive.google.com/drive/folders/abc')
  assert.equal(state.obsidianNote, null)
  assert.deepEqual([state.sections.inProgress, state.sections.pending, state.sections.nextSteps], [['Integración de leads'], ['Prueba de aceptación'], ['Verificar cronjob']])
  assert.equal(parseProjectState('bloqueoPrincipal: Ninguno\n').mainBlocker, null)
  // Other shapes found in real files: emoji before the title, a status table, a status section, plain "Actualizado:".
  const table = parseProjectState('# 📊 Estado del Proyecto — Landing Montesvisión\n\n**Progreso General:** Desarrollo avanzado\n\n| Métrica | Valor |\n|---|---|\n| Cliente | Montesvisión |\n| Status | EN DESARROLLO |\n\n### ✅ Hecho (2026-08-05)\n- Landing desarrollada\n\n### 🟡 Pendiente (a definir)\n- [ ] Confirmar con el cliente\n')
  assert.deepEqual([table.title, table.generalStatus, table.sections.completed, table.sections.pending], ['Landing Montesvisión', 'Desarrollo avanzado', ['Landing desarrollada'], ['Confirmar con el cliente']])
  const prose = parseProjectState('# Estado del proyecto: El mundo de Lucía\n\nActualizado: 1 de octubre de 2026\n\n## 2. Estado general\n\nSitio publicado y en revisión.\n\nSegundo párrafo.\n\n## Continuación del trabajo\n\n- Verificar el dominio\n')
  assert.deepEqual([prose.title, prose.updatedLabel, prose.generalStatus, prose.sections.nextSteps], ['El mundo de Lucía', '1 de octubre de 2026', 'Sitio publicado y en revisión.', ['Verificar el dominio']])
})

test('repairs files saved with the wrong encoding and recognises the file names in use', () => {
  const broken = Buffer.from(template, 'utf8').toString('latin1')
  assert.notEqual(broken, template)
  assert.equal(repairEncoding(broken), template)
  assert.equal(parseProjectState(broken).sections.pending[0], 'Pruebas en móvil')
  assert.equal(repairEncoding('Texto sano con ñ'), 'Texto sano con ñ')
  for (const name of ['PROYECTO_ESTADO.md', 'ESTADO_PROYECTO.md', 'Estado proyecto Vertice_Dmente.md', 'estado_can_friends.md', 'ESTADO.md', 'Estado del Proyecto.md']) assert.equal(isProjectStateFile(name), true, name)
  for (const name of ['README.md', 'PROYECTO_ESTADO.txt', 'Leccion_4_CAPI_Estado.md', 'estados_financieros.md']) assert.equal(isProjectStateFile(name), false, name)
})
