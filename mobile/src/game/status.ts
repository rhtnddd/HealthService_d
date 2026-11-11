// 제출건 상태 문구와 행동 (DESIGN.md 4절 표의 문구 [제안]).
import type { Submission, SubmissionStatus } from '../api/game';

export const STATUS_TEXT: Record<SubmissionStatus, { label: string; detail: string; tone: 'accent' | 'warning' | 'muted' | 'danger' }> = {
  SUBMITTED: { label: '계산 중', detail: '운동 기록을 접수했어요. 보상을 계산 중이에요', tone: 'muted' },
  PREPARED: { label: '미리보기', detail: '보상 미리보기 · 아직 지급 전이에요', tone: 'warning' },
  PENDING_REVIEW: { label: '확인 대기', detail: '확인자의 검토를 기다리고 있어요', tone: 'warning' },
  APPROVED: { label: '승인', detail: '승인됐어요. 보상을 반영 중이에요', tone: 'accent' },
  REWARDED: { label: '지급 완료', detail: '보상이 반영됐어요', tone: 'accent' },
  CANCELED: { label: '취소', detail: '제출이 취소됐어요', tone: 'muted' },
  REJECTED: { label: '반려', detail: '반려됐어요. 기록을 종료 중이에요', tone: 'danger' },
  CLOSED: { label: '종료', detail: '종료된 기록이에요', tone: 'danger' },
  REVOKED: { label: '회수', detail: '보상이 회수됐어요', tone: 'danger' },
};

// 정상 경로 단계 (PRD 2절)
export const FLOW: SubmissionStatus[] = ['SUBMITTED', 'PREPARED', 'APPROVED', 'REWARDED'];

export function flowIndex(status: SubmissionStatus): number {
  if (status === 'PENDING_REVIEW') return 1;
  return FLOW.indexOf(status);
}

/** 승인 전이면 신청자가 취소할 수 있다 (US-06). */
export const canCancel = (s: Submission) => s.status === 'SUBMITTED' || s.status === 'PREPARED' || s.status === 'PENDING_REVIEW';

/** 자동 승인 대상이 아닌 PREPARED 건은 확인 요청 버튼을 보여 준다 (US-03 (실패·거절), US-07). */
export function needsReview(s: Submission, threshold = 0.9): boolean {
  return s.status === 'PREPARED' && (s.confidence < threshold || s.livenessPassed !== true);
}

/** 서버가 자동으로 다음 단계로 넘기는 중인 상태 (화면이 다시 조회한다). */
export function isProcessing(s: Submission, threshold = 0.9): boolean {
  return s.status === 'SUBMITTED' || s.status === 'APPROVED' || (s.status === 'PREPARED' && !needsReview(s, threshold));
}

export const EXERCISE_NAME: Record<string, string> = { SQUAT: '스쿼트' };
export const SKILL_NAME: Record<string, string> = { SQUAT: '충격파 스톰프' }; // 시연 문구 (PRD 2절 5단계)

// 운동 부위 → 공격 동작. 상체 운동은 주먹, 하체 운동은 발차기 [제안].
// MVP 운동은 스쿼트(하체)뿐이라 지금은 발차기만 나온다. 푸시업 등은 MVP 제외(mvp-scope.md)라 부위만 미리 적어 둠
export const EXERCISE_BODY: Record<string, 'UPPER' | 'LOWER'> = { SQUAT: 'LOWER', LUNGE: 'LOWER', PUSHUP: 'UPPER', PULLUP: 'UPPER' };
export type AttackKind = 'PUNCH' | 'KICK';
export const attackKindOf = (exerciseCode: string): AttackKind => EXERCISE_BODY[exerciseCode] === 'UPPER' ? 'PUNCH' : 'KICK';
export const ATTACK_LABEL: Record<AttackKind, string> = { PUNCH: '주먹', KICK: '발차기' };

export function kstDateTime(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 9 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

export function hoursLeft(iso: string, now = Date.now()): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - now) / 3600000));
}

/** AI 참고 설명이 짚은 렙 번호를 짧게 (예: '2·3·4회 외 5개'). 없으면 빈 문자열. */
export function repLabel(repNos: number[], max = 4): string {
  if (repNos.length === 0) return '';
  const head = repNos.slice(0, max).join('·') + '회';
  return repNos.length > max ? `${head} 외 ${repNos.length - max}개` : head;
}
