// 운동 세션 계산 (화면과 분리한 순수 함수라 tsx --test로 검사한다).
//
// [임시] 카메라 자세 인식(VisionCamera + fast-tflite)은 개발 빌드가 필요해 Expo Go·시뮬레이터에서
// 돌릴 수 없다 (STACK.md '개발 빌드'). 그래서 지금은 '데모 인식'으로 스쿼트 동작을 흉내 낸
// 관절 좌표를 만든다. 형식은 서버 계약(API-022: MoveNet 17점 [x, y, visibility], 얼굴 0~4번 null)과 같다.
import type { PoseFrame, RepIn } from '../api/game';

export const KEYPOINTS = 17; // MoveNet(COCO 17)
export const FACE_INDEXES = [0, 1, 2, 3, 4]; // 코·눈·귀: 기기 밖으로 보내지 않는다 (R11)
export const AUTO_APPROVAL_THRESHOLD = 0.9; // 서버 review/rules.py와 같음 (기준 미확정)

// MoveNet 17점 서 있는 자세 (정규화 좌표 0~1)
const STAND: [number, number][] = [
  [0.5, 0.12], [0.48, 0.1], [0.52, 0.1], [0.46, 0.11], [0.54, 0.11],
  [0.42, 0.22], [0.58, 0.22], [0.38, 0.36], [0.62, 0.36], [0.36, 0.48], [0.64, 0.48],
  [0.45, 0.5], [0.55, 0.5], [0.45, 0.7], [0.55, 0.7], [0.45, 0.9], [0.55, 0.9],
];

/** 스쿼트 깊이 depth(0 서 있음 ~ 1 가장 낮음)의 관절 좌표. 얼굴 점은 null. */
export function poseAt(depth: number): PoseFrame['kp'] {
  const d = Math.max(0, Math.min(1, depth));
  return STAND.map(([x, y], i) => {
    if (FACE_INDEXES.includes(i)) return null;
    let ny = y;
    if (i <= 12) ny = y + 0.18 * d; // 상체·엉덩이가 내려감
    if (i === 13 || i === 14) { ny = y + 0.04 * d; return [round(x + (i === 13 ? -0.06 : 0.06) * d), round(ny), 0.9]; }
    return [round(x), round(ny), 0.9];
  });
}

const round = (v: number) => Math.round(v * 1000) / 1000;

/** 렙 기록에서 프레임(10fps)을 만들어 청크 크기(maxFrames)로 나눈다. seq는 1부터 (API-022·026). */
export function buildChunks(startMs: number, reps: { ts: number }[], endMs: number, maxFrames = 300, fps = 10): PoseFrame[][] {
  const frames: PoseFrame[] = [];
  const step = 1000 / fps;
  for (let t = startMs; t <= endMs; t += step) {
    // 각 렙 시각 주변 1.6초 동안 내려갔다 올라오는 모양
    const near = reps.reduce((m, r) => Math.min(m, Math.abs(t - (r.ts - 800))), Infinity);
    const depth = near < 800 ? Math.cos((near / 800) * (Math.PI / 2)) : 0;
    frames.push({ t: Math.round(t - startMs), kp: poseAt(depth) });
  }
  if (frames.length === 0) frames.push({ t: 0, kp: poseAt(0) });
  const chunks: PoseFrame[][] = [];
  for (let i = 0; i < frames.length; i += maxFrames) chunks.push(frames.slice(i, i + maxFrames));
  return chunks;
}

export function hasFace(frames: PoseFrame[]): boolean {
  return frames.some((f) => FACE_INDEXES.some((i) => f.kp[i] != null));
}

/** 제출 본문의 렙 목록 (API-026). ts는 ISO 문자열. */
export function toRepIn(reps: { ts: number; counted: boolean }[]): RepIn[] {
  return reps.map((r, i) => ({ repNo: i + 1, ts: new Date(r.ts).toISOString(), counted: r.counted }));
}

/**
 * 데모 인식의 확신도. 인정 비율이 높을수록 높다 [임시: 확신도 계산 방법 미정, PRD 미정 표].
 * shaky(자세가 흔들림)면 기준 아래로 내려가 확인 요청 흐름(US-07)을 볼 수 있다.
 */
export function demoConfidence(counted: number, total: number, shaky: boolean): number {
  if (total === 0) return 0;
  const base = 0.86 + 0.12 * (counted / total);
  return Math.round((shaky ? base - 0.15 : base) * 100) / 100;
}

/** 데모 인식에서 이번 렙을 인정할지. shaky면 4번에 1번꼴로 가동범위 미달. */
export function demoRepCounted(repNo: number, shaky: boolean): boolean {
  return shaky ? repNo % 4 !== 3 : repNo % 11 !== 7;
}

export const LIVENESS_LABEL: Record<string, string> = {
  RAISE_LEFT_HAND: '왼손을 들어 주세요',
  RAISE_RIGHT_HAND: '오른손을 들어 주세요',
  RAISE_BOTH_HANDS: '두 손을 모두 들어 주세요',
};
