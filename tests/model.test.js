import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clamp01,
  compute,
  getFocusedKey,
  getWeightBytes,
  getScopeSteps
} from '../model.js';

const baseParams = {
  modelSize: 7,
  contextLen: 2048,
  batchSize: 1,
  quantBits: 4,
  l1Size: 64,
  l2Size: 2,
  l3Size: 24,
  dramBw: 80,
  ssdBw: 3,
  offloadRate: 20
};

test('clamp01 clamps values into [0, 1]', () => {
  assert.equal(clamp01(-0.1), 0);
  assert.equal(clamp01(0.4), 0.4);
  assert.equal(clamp01(1.2), 1);
});

test('getScopeSteps and getFocusedKey normalize focus index', () => {
  const steps = getScopeSteps('meso');
  assert.deepEqual(steps, ['l1Access', 'l2Access', 'l3Access', 'dramAccess']);

  assert.deepEqual(getFocusedKey('meso', -1), { key: 'dramAccess', focusIndex: 3 });
  assert.deepEqual(getFocusedKey('meso', 6), { key: 'l3Access', focusIndex: 2 });
});

test('getWeightBytes scales with model size and quantization bits', () => {
  assert.equal(
    getWeightBytes({ modelSize: 1, quantBits: 8 }),
    1e9
  );
  assert.equal(
    getWeightBytes({ modelSize: 2, quantBits: 4 }),
    1e9
  );
});

test('compute returns positive latency metrics and bounded hit rates', () => {
  const result = compute(baseParams);

  assert.ok(result.decodeLatencyMs > 0);
  assert.ok(result.ttftMs > result.decodeLatencyMs);
  assert.ok(result.tokensPerSec > 0);

  assert.ok(result.l1Hit >= 0 && result.l1Hit <= 1);
  assert.ok(result.l2Hit >= 0 && result.l2Hit <= 1);
  assert.ok(result.l3Hit >= 0 && result.l3Hit <= 1);
});

test('higher offload increases SSD access and tends to increase decode latency', () => {
  const lowOffload = compute({ ...baseParams, offloadRate: 0 });
  const highOffload = compute({ ...baseParams, offloadRate: 80 });

  assert.equal(lowOffload.ssdAccess, 0);
  assert.ok(highOffload.ssdAccess > lowOffload.ssdAccess);
  assert.ok(highOffload.decodeLatencyMs > lowOffload.decodeLatencyMs);
});
