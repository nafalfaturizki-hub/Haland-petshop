const test = require('node:test');
const assert = require('node:assert/strict');
const { serializeStructuredItems, parseStructuredItems, buildStructuredItemsForForm, serializeStructuredItemsFromInput } = require('../lib/medical-record-utils');

test('serializeStructuredItems returns compact JSON for items', () => {
  const value = serializeStructuredItems([
    { id: 'proc-1', name: 'Cek darah', qty: 1, notes: 'Pagi' },
  ]);

  assert.equal(value, '[{"id":"proc-1","name":"Cek darah","qty":1,"notes":"Pagi"}]');
});

test('parseStructuredItems handles legacy text and JSON payloads', () => {
  assert.deepEqual(parseStructuredItems('Cek darah | 1 | Pagi'), [
    { id: '', name: 'Cek darah', qty: 1, notes: 'Pagi' },
  ]);

  assert.deepEqual(parseStructuredItems('[{"id":"proc-1","name":"Cek darah","qty":2,"notes":"Sore"}]'), [
    { id: 'proc-1', name: 'Cek darah', qty: 2, notes: 'Sore' },
  ]);
});

test('buildStructuredItemsForForm and serializeStructuredItemsFromInput round-trip form values', () => {
  const items = buildStructuredItemsForForm('Cek darah | 2 | Pagi\nRawat luka | 1');
  assert.deepEqual(items, [
    { id: '', name: 'Cek darah', qty: 2, notes: 'Pagi' },
    { id: '', name: 'Rawat luka', qty: 1, notes: null },
  ]);

  assert.equal(serializeStructuredItemsFromInput(items), '[{"id":"","name":"Cek darah","qty":2,"notes":"Pagi"},{"id":"","name":"Rawat luka","qty":1,"notes":null}]');
});
