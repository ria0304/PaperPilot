import { parseBst } from '../src/layout.js'
import { test, expect } from 'vitest'


function makeBstInput(keys) {
  return '[bst ' + keys.join(' ') + ']'
}


test('parses empty string returns null', () => {
  expect(parseBst('')).toBeNull()
})


test('parses basic bst with 3 keys', () => {
  const result = parseBst('[bst 50 30 70]')
  expect(result).not.toBeNull()
  expect(result.nodes).toHaveLength(3)
  expect(result.n).toBe(3)
  expect(result.depth).toBe(2)
})


test('parses bst with 15 keys max', () => {
  const keys = Array.from({ length: 15 }, (_, i) => 10 + i)
  const result = parseBst('[bst ' + keys.join(' ') + ']')
  expect(result).not.toBeNull()
  expect(result.n).toBe(15)
  expect(result.depth).toBeGreaterThan(0)
})


test('parses bst with more than 15 keys (should truncate to 15)', () => {
  const keys = Array.from({ length: 20 }, (_, i) => i)
  const result = parseBst('[bst ' + keys.join(' ') + ']')
  expect(result.n).toBe(15)
})


test('parses bst with negative keys', () => {
  const result = parseBst('[bst -5 0 5]')
  expect(result).not.toBeNull()
  expect(result.n).toBe(3)
})


test('parses bst with single key', () => {
  const result = parseBst('[bst 42]')
  expect(result).not.toBeNull()
  expect(result.n).toBe(1)
  expect(result.depth).toBe(1)
})