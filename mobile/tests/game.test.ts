import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Submission } from '../src/api/game';
import { canCancel, flowIndex, isProcessing, needsReview } from '../src/game/status';
import { FACE_INDEXES, KEYPOINTS, buildChunks, demoConfidence, demoRepCounted, hasFace, poseAt, toRepIn } from '../src/game/workout';

const sub = (over: Partial<Submission>): Submission => ({
  id: 's', sessionId: 'w', exerciseCode: 'SQUAT', status: 'PREPARED', version: 1, approvalPath: null,
  startedAt: '2026-11-12T00:00:00Z', endedAt: '2026-11-12T00:01:00Z', countedReps: 30, reservedReps: 30,
  confidence: 0.94, livenessPassed: true, ...over,
});

describe('US-01 데모 인식이 만드는 관절 좌표', () => {
  it('17점이고 얼굴(0~4번)은 보내지 않는다 (R11)', () => {
    const kp = poseAt(0.5);
    assert.equal(kp.length, KEYPOINTS);
    for (const i of FACE_INDEXES) assert.equal(kp[i], null);
    assert.ok(kp.slice(5).every((k) => Array.isArray(k) && k.length === 3));
  });
  it('청크는 maxFrames를 넘지 않고, 모든 프레임에 얼굴이 없다', () => {
    const start = 0;
    const reps = Array.from({ length: 30 }, (_, i) => ({ ts: 1800 * (i + 1) }));
    const chunks = buildChunks(start, reps, 1800 * 31, 300);
    assert.ok(chunks.length >= 2);
    assert.ok(chunks.every((c) => c.length <= 300 && c.length > 0));
    assert.equal(chunks.flat().some((f) => hasFace([f])), false);
  });
  it('렙 번호는 1부터, ts는 ISO 문자열', () => {
    const r = toRepIn([{ ts: 0, counted: true }, { ts: 1000, counted: false }]);
    assert.deepEqual(r.map((x) => x.repNo), [1, 2]);
    assert.equal(r[1].ts, '1970-01-01T00:00:01.000Z');
  });
});

describe('US-03 데모 확신도', () => {
  it('정상 자세는 기준(0.9) 이상, 흔들리는 자세는 미만', () => {
    const steady = Array.from({ length: 30 }, (_, i) => demoRepCounted(i + 1, false)).filter(Boolean).length;
    const shaky = Array.from({ length: 30 }, (_, i) => demoRepCounted(i + 1, true)).filter(Boolean).length;
    assert.ok(demoConfidence(steady, 30, false) >= 0.9);
    assert.ok(demoConfidence(shaky, 30, true) < 0.9);
    assert.equal(demoConfidence(0, 0, false), 0);
  });
});

describe('US-03·06·07 제출 상태에 따른 화면 행동', () => {
  it('기준 미만이거나 동작 확인을 못 하면 확인 요청 버튼', () => {
    assert.equal(needsReview(sub({ confidence: 0.8 })), true);
    assert.equal(needsReview(sub({ livenessPassed: false })), true);
    assert.equal(needsReview(sub({})), false);
    assert.equal(needsReview(sub({ status: 'APPROVED', confidence: 0.5 })), false);
  });
  it('승인 전 세 상태에서만 취소', () => {
    for (const s of ['SUBMITTED', 'PREPARED', 'PENDING_REVIEW'] as const) assert.equal(canCancel(sub({ status: s })), true);
    for (const s of ['APPROVED', 'REWARDED', 'CANCELED', 'CLOSED'] as const) assert.equal(canCancel(sub({ status: s })), false);
  });
  it('서버가 처리 중인 상태는 다시 조회한다', () => {
    assert.equal(isProcessing(sub({ status: 'SUBMITTED' })), true);
    assert.equal(isProcessing(sub({ status: 'PREPARED' })), true);
    assert.equal(isProcessing(sub({ status: 'PREPARED', confidence: 0.7 })), false);
    assert.equal(isProcessing(sub({ status: 'REWARDED' })), false);
  });
  it('확인 대기는 계산 다음 단계에 표시', () => {
    assert.equal(flowIndex('PENDING_REVIEW'), 1);
    assert.equal(flowIndex('REWARDED'), 3);
  });
});
