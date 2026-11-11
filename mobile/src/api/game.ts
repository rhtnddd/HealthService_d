// 운동·제출·확인·보상·전투 API (API-007·010~017·018~030·032·034~040·043~048).
// 응답 필드 이름은 서버 camelCase 그대로 (backend Swagger). 상태를 바꾸는 요청은 If-Match에 version을 넣는다.
import type { createHttp } from './http';

type Http = ReturnType<typeof createHttp>;

export type SubmissionStatus =
  | 'SUBMITTED' | 'PREPARED' | 'PENDING_REVIEW' | 'APPROVED' | 'REWARDED' | 'REJECTED' | 'CLOSED' | 'CANCELED' | 'REVOKED';

export type Submission = {
  id: string; sessionId: string; exerciseCode: string; status: SubmissionStatus; version: number;
  approvalPath: 'AI_AUTO' | 'REVIEWER' | null; startedAt: string; endedAt: string;
  countedReps: number; reservedReps: number; confidence: number; livenessPassed: boolean | null;
};
export type Character = {
  userId: string; avatarId: string | null; level: number; exp: { confirmed: number; pending: number }; lockedItemCount: number;
};
export type Exercise = {
  code: string; name: string; dailyCap: number; criteria: { kneeAngleMax?: number | null };
  recommendedCameraAngle?: string | null; tutorialUrl?: string | null;
};
export type DailyCap = { exerciseCode: string; cap: number; reserved: number; remaining: number };
export type StartedSession = {
  sessionId: string; status: string; catalogVersion: string; remainingDailyCap: number;
  liveness: { challengeId: string; action: string; timeoutSec: number }; chunkSpec: { maxFrames: number; maxBytes: number };
};
export type Target = { type: 'DUNGEON' | 'BOSS'; id: string };
export type RepIn = { repNo: number; ts: string; counted: boolean };
export type PoseFrame = { t: number; kp: ([number, number, number] | null)[] };
export type Snapshot = { catalogVersion: string; hitCount: number; exp: number; totalDamage: number; weaknessMultiplier: number; dropCount: number };
export type Narrative = { level: string; text: string; isFallback: boolean };
export type RewardPreview = { status: SubmissionStatus; snapshot: Snapshot; narrative: Narrative } | { status: SubmissionStatus; retryAfterSec: number };
export type Anomaly = { type: string; repNos: number[]; description: string };
export type SharePreview = { skeletonReplayUrl: string | null; summary: string | null; anomalies: Anomaly[]; painNotice: string | null };
export type Acquaintance = { userId: string; nickname: string; relation: 'GUILD_LEADER' | 'GUILD_MEMBER' | string };
export type ReceivedReview = { submissionId: string; requester: { userId: string; nickname: string }; exerciseCode: string; countedReps: number; requestedAt: string };
export type ReviewDetail = SharePreview & {
  submissionId: string; status: SubmissionStatus; version: number; requester: { nickname: string };
  exerciseCode: string; countedReps: number; confidence: number;
};
export type RejectReason = { code: string; label: string };
export type Item = { itemId: string; submissionId: string; status: 'LOCKED' | 'UNLOCKED' | string; unlockAt: string };
export type RewardEntry = { submissionId: string; exp: number; items: { itemId: string; status: string }[]; damage: number; rewardedAt: string; protectionEndsAt: string };
export type Guild = { id: string; name: string; leader: { userId: string; nickname: string }; memberCount: number };
export type GuildMember = { userId: string; nickname: string; role: 'LEADER' | 'MEMBER' };
export type Boss = { bossId: string; status: 'ACTIVE' | 'DEFEATED'; hpMax: number; hp: number; guildTotalDamage: number; weekStart: string; weekEnd: string };
export type Dungeon = { id: string; name: string; enemy: { name: string; hpMax: number; hp: number }; myProgress: { totalDamage: number } };
export type ResultCard = {
  card: { exerciseCode: string; countedReps: number; hitCount: number; exp: number; totalDamage: number;
    drops: { itemId: string; status: string }[]; rewardedAt: string; dailyCapExceeded: boolean };
  narrative: Narrative; formComment: Narrative;
};
export type Replay = { hitCount: number; events: { repIndex: number; t: number; type: 'HIT' | 'MISS'; damage?: number | null; reason?: string | null }[] };

// 데모 던전 ID (backend battle/catalog.py DEMO_DUNGEON_ID, 서버에 고정)
export const DEMO_DUNGEON_ID = '3d1f6c2a-5b7e-4c1a-9f0e-2a8b6d4c1e70';

const q = (id: string) => encodeURIComponent(id);
const ifMatch = (version: number) => ({ 'If-Match': `"${version}"` });

export function uuid(): string {
  // crypto.randomUUID가 없는 런타임(Hermes 일부)을 위한 v4
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function createGameApi(http: Http) {
  return {
    // 캐릭터·보상
    character: () => http.request<Character>('/characters/me'),
    inventory: async () => (await http.request<{ items: Item[] }>('/me/inventory')).items,
    rewards: async () => (await http.request<{ items: RewardEntry[] }>('/me/rewards')).items,

    // 길드·지인
    guild: (id: string) => http.request<Guild>(`/guilds/${q(id)}`),
    guildMembers: async (id: string) => (await http.request<{ items: GuildMember[] }>(`/guilds/${q(id)}/members?limit=50`)).items,
    createGuild: (name: string) => http.request<{ guildId: string }>('/guilds', { method: 'POST', body: { name } }),
    invite: (id: string) => http.request<{ inviteCode: string; expiresAt: string }>(`/guilds/${q(id)}/invitations`, { method: 'POST', body: {} }),
    leaveGuild: (id: string) => http.request<void>(`/guilds/${q(id)}/members/me`, { method: 'DELETE' }),
    boss: (guildId: string) => http.request<Boss>(`/guilds/${q(guildId)}/boss`),
    dungeon: (id: string) => http.request<Dungeon>(`/dungeons/${q(id)}`),
    acquaintances: async () => (await http.request<{ items: Acquaintance[] }>('/me/acquaintances')).items,

    // 운동 세션
    exercises: () => http.request<{ catalogVersion: string; items: Exercise[] }>('/exercises'),
    dailyCaps: () => http.request<{ date: string; items: DailyCap[] }>('/me/daily-caps'),
    startSession: (body: { exerciseCode: string; goal: { reps: number; sets: number }; target: Target | null }) =>
      http.request<StartedSession>('/workout-sessions', { method: 'POST', body }),
    liveness: (id: string, body: { challengeId: string; detectedAction: string; score: number; detectedAt: string }) =>
      http.request<{ passed: boolean; retryAllowed: boolean }>(`/workout-sessions/${q(id)}/liveness`, { method: 'POST', body }),
    uploadChunk: (id: string, seq: number, frames: PoseFrame[]) =>
      http.request<{ received: number[] }>(`/workout-sessions/${q(id)}/pose-chunks/${seq}`, { method: 'PUT', body: { seq, frames } }),
    pause: (id: string, reason: 'CAMERA_LOST' | 'APP_BACKGROUND') =>
      http.request<{ status: string }>(`/workout-sessions/${q(id)}/pause`, { method: 'POST', body: { reason, at: new Date().toISOString() } }),
    resume: (id: string) => http.request<{ status: string }>(`/workout-sessions/${q(id)}/resume`, { method: 'POST' }),
    discard: (id: string) => http.request<void>(`/workout-sessions/${q(id)}`, { method: 'DELETE' }),
    submit: (id: string, key: string, body: { totalChunks: number; endedAt: string; clientRepCount: number; reps: RepIn[]; aiConfidence: number }) =>
      http.request<{ submissionId: string; status: SubmissionStatus; countedReps: number; reservedReps: number; version: number }>(
        `/workout-sessions/${q(id)}/submit`, { method: 'POST', body, headers: { 'Idempotency-Key': key } }),

    // 제출건
    submission: (id: string) => http.request<Submission>(`/submissions/${q(id)}`),
    mySubmissions: async (limit = 20) => (await http.request<{ items: Submission[] }>(`/me/submissions?limit=${limit}`)).items,
    cancel: (id: string, version: number) =>
      http.request<{ status: SubmissionStatus; releasedReps: number; version: number }>(`/submissions/${q(id)}/cancel`, { method: 'POST', body: {}, headers: ifMatch(version) }),
    rewardPreview: (id: string) => http.request<RewardPreview>(`/submissions/${q(id)}/reward-preview`),
    sharePreview: (id: string) => http.request<SharePreview>(`/submissions/${q(id)}/review-share-preview`),
    requestReview: (id: string, version: number, reviewerUserId: string) =>
      http.request<{ submissionStatus: SubmissionStatus; version: number; reviewer: { nickname: string } }>(`/submissions/${q(id)}/review-requests`,
        { method: 'POST', body: { reviewerUserId, sharePreviewConfirmed: true }, headers: ifMatch(version) }),

    // 확인자
    receivedReviews: async () => (await http.request<{ items: ReceivedReview[] }>('/me/review-requests')).items,
    reviewDetail: (id: string) => http.request<ReviewDetail>(`/review-requests/${q(id)}`),
    approve: (id: string, version: number) =>
      http.request<{ submissionStatus: SubmissionStatus }>(`/review-requests/${q(id)}/approve`, { method: 'POST', headers: ifMatch(version) }),
    reject: (id: string, version: number, reasonCode: string, reasonText: string) =>
      http.request<{ submissionStatus: SubmissionStatus }>(`/review-requests/${q(id)}/reject`, { method: 'POST', body: { reasonCode, reasonText }, headers: ifMatch(version) }),
    rejectReasons: async () => (await http.request<{ items: RejectReason[] }>('/reject-reasons', { auth: false })).items,

    // 결과
    result: (id: string) => http.request<ResultCard>(`/submissions/${q(id)}/result`),
    replay: (id: string) => http.request<Replay>(`/submissions/${q(id)}/replay`),
  };
}
