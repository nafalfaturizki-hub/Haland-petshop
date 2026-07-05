const test = require('node:test');
const assert = require('node:assert/strict');
const { serializeStructuredItems, parseStructuredItems } = require('../lib/medical-record-utils');

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
