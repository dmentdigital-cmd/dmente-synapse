import assert from 'node:assert/strict'
import { test } from 'node:test'
import { classifyAccountHealth } from '../server/account-health.js'

test('account health classification is deterministic and preserves uncertainty', () => {
  assert.equal(classifyAccountHealth([{ label: 'Uso', value: '58%', severity: 'red' }], []), 'rojo')
  assert.equal(classifyAccountHealth([{ label: 'NPS', value: '6', severity: 'yellow' }], []), 'amarillo')
  assert.equal(classifyAccountHealth([{ label: 'Uso', value: '68%', severity: 'green' }], []), 'verde')
  assert.equal(classifyAccountHealth([{ label: 'NPS', value: 'sin dato', severity: 'unknown' }], ['Falta la última respuesta']), 'amarillo')
})
