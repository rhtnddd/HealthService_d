// 제출 상세·보상 미리보기: 처리 단계, 고정된 보상·타격 수, 확신도, 취소·확인 요청 (JN-022·002·003·006·007, US-02·03·06·07)
import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Image, StyleSheet, Text, View } from 'react-native';
import type { RewardPreview, SubmissionStatus } from '../../src/api/game';
import { game } from '../../src/auth/session';
import { monsterOf } from '../../src/game/assets';
import { EXERCISE_NAME, FLOW, SKILL_NAME, STATUS_TEXT, canCancel, flowIndex, isProcessing, kstDateTime, needsReview } from '../../src/game/status';
import { Card, ErrorBox, Loading, Muted, OB, Page, Stat, StatusChip, TopBar, errorMessage, useLoad } from '../../src/game/ui';
import { ErrorText, PillButton } from '../../src/onboarding/ui';
import { COLORS } from '../../src/theme/tokens';

const STEP_LABEL: Record<string, string> = { SUBMITTED: '접수', PREPARED: '계산', APPROVED: '승인', REWARDED: '지급' };

export default function SubmissionDetail() {
  const { id, targetType, targetId } = useLocalSearchParams<{ id: string; targetType?: string; targetId?: string }>();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const { data, error, loading, reload, silent } = useLoad(async () => {
    const s = await game.submission(id);
    let preview: RewardPreview | null = null;
    if (s.status !== 'SUBMITTED' && s.status !== 'CANCELED') preview = await game.rewardPreview(id).catch(() => null);
    return { s, preview };
  }, [id]);

  // 서버가 다음 단계로 넘기는 동안 다시 조회한다 (DESIGN.md 5절 '실제 단계별 표시')
  const processing = data ? isProcessing(data.s) : false;
  useEffect(() => {
    if (!processing) return;
    const t = setInterval(() => void silent(), 1500);
    return () => clearInterval(t);
  }, [processing, silent]);

  if (loading) return <Page><TopBar title="운동 기록" /><Loading /></Page>;
  if (!data) return <Page><TopBar title="운동 기록" /><ErrorBox message={error ?? '기록을 찾을 수 없어요.'} onRetry={reload} /></Page>;
  const { s, preview } = data;
  const snap = preview && 'snapshot' in preview ? preview.snapshot : null;
  const narrative = preview && 'narrative' in preview ? preview.narrative : null;
  const ended = s.status === 'CANCELED' || s.status === 'REJECTED' || s.status === 'CLOSED';
  const capExceeded = s.reservedReps === 0 && s.countedReps > 0;
  const target = targetType === 'BOSS' || targetType === 'DUNGEON' ? { type: targetType, id: targetId } : null;

  const cancel = () => Alert.alert('제출을 취소할까요?', '취소하면 오늘 상한에서 이 기록의 횟수가 빠지고 보상도 받지 않아요.', [
    { text: '아니요', style: 'cancel' },
    { text: '취소하기', style: 'destructive', onPress: async () => {
      setBusy(true); setActionError(null);
      try { await game.cancel(s.id, s.version); await silent(); } catch (e) { setActionError(errorMessage(e)); await silent(); } finally { setBusy(false); }
    } },
  ]);

  return <Page onRefresh={reload}>
    <TopBar title="운동 기록" />
    <View style={{ gap: 8 }}>
      <StatusChip status={s.status} />
      <Text style={styles.title}>{EXERCISE_NAME[s.exerciseCode] ?? s.exerciseCode} {s.countedReps}회</Text>
      <Muted>{kstDateTime(s.startedAt)} · {STATUS_TEXT[s.status].detail}</Muted>
    </View>

    {!ended && <Steps status={s.status} />}

    <Card style={styles.preview} highlight={!!snap && !ended}>
      {target && <Image source={monsterOf(target as { type: 'DUNGEON' | 'BOSS'; id?: string })} style={styles.monster} resizeMode="contain" />}
      <Text style={styles.label}>보상 미리보기</Text>
      {snap ? <>
        {capExceeded
          ? <Text style={styles.skill}>일일 상한 초과</Text>
          : <Text style={styles.skill}>{SKILL_NAME[s.exerciseCode] ?? '공격'} <Text style={{ color: COLORS.primary }}>×{snap.hitCount}</Text></Text>}
        <View style={styles.stats}>
          <Stat label="경험치" value={`+${snap.exp}`} accent />
          <Stat label="총 피해" value={snap.totalDamage.toLocaleString()} />
          <Stat label="보상 상자" value={snap.dropCount} />
        </View>
        {capExceeded && <Muted>오늘 상한을 다 써서 이 기록은 보상 없이 남아요.</Muted>}
      </> : <Text style={styles.calc}>{s.status === 'CANCELED' ? '취소된 기록이라 보상이 없어요' : '보상과 타격 수를 계산하고 있어요…'}</Text>}
    </Card>

    {narrative && !ended && <Card style={{ gap: 6 }}>
      <Text style={styles.label}>전투 예고 {narrative.isFallback ? '· 기본 문구' : '· AI 서사'}</Text>
      <Text style={styles.story}>{narrative.text}</Text>
    </Card>}

    <Card style={styles.judge}>
      <Stat label="AI 확신도" value={`${Math.round(s.confidence * 100)}%`} accent={s.confidence >= 0.9} />
      <Stat label="동작 확인" value={s.livenessPassed ? '통과' : s.livenessPassed === false ? '실패' : '안 함'} />
      <Stat label="승인 경로" value={s.approvalPath === 'AI_AUTO' ? 'AI 자동' : s.approvalPath === 'REVIEWER' ? '확인자' : '—'} />
    </Card>

    {needsReview(s) && <Card style={styles.reviewCard}>
      <Text style={styles.reviewTitle}>사람의 확인이 필요해요</Text>
      <Muted>AI 확신도가 기준(90%)보다 낮거나 본인 확인 동작을 통과하지 못했어요. 지인이나 길드장에게 확인을 요청해 주세요. 얼굴·나이·길드명은 보내지 않아요.</Muted>
      <PillButton title="확인 요청 보내기" onPress={() => router.push({ pathname: '/submission/review', params: { id: s.id } })} />
    </Card>}

    <ErrorText>{actionError}</ErrorText>
    {s.status === 'REWARDED' && <PillButton title="전투 결과 보기" arrow onPress={() => router.push({ pathname: '/result/[id]', params: { id: s.id, targetType: targetType ?? '', targetId: targetId ?? '' } })} />}
    {canCancel(s) && <PillButton title="제출 취소" variant="secondary" loading={busy} onPress={cancel} />}
    <PillButton title="홈으로" variant="text" onPress={() => router.replace('/home')} />
  </Page>;
}

function Steps({ status }: { status: SubmissionStatus }) {
  const at = flowIndex(status);
  return <View style={styles.steps} accessibilityLabel={`처리 단계 ${at + 1}/4`}>
    {FLOW.map((st, i) => {
      const done = i <= at;
      const waiting = status === 'PENDING_REVIEW' && i === 2;
      return <View key={st} style={styles.step}>
        <View style={[styles.stepDot, done && styles.stepDotOn, waiting && { borderColor: COLORS.warning }]}>{done && <View style={styles.stepCore} />}</View>
        <Text style={[styles.stepText, done && { color: COLORS.text }, waiting && { color: COLORS.warning }]}>{waiting ? '확인 대기' : STEP_LABEL[st]}</Text>
        {i < FLOW.length - 1 && <View style={[styles.stepLine, i < at && { backgroundColor: COLORS.primary }]} />}
      </View>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  title: { color: COLORS.text, fontSize: 30, fontWeight: '800' },
  steps: { flexDirection: 'row', marginVertical: 4 },
  step: { flex: 1, alignItems: 'center', gap: 6 },
  stepDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: OB.dot, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000', zIndex: 1 },
  stepDotOn: { borderColor: COLORS.primary },
  stepCore: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },
  stepText: { color: OB.dim, fontSize: 12, fontWeight: '600' },
  stepLine: { position: 'absolute', top: 10, left: '50%', width: '100%', height: 2, backgroundColor: OB.dot },
  preview: { gap: 12, padding: 20, overflow: 'hidden', minHeight: 170 },
  monster: { position: 'absolute', right: -16, top: -6, width: 140, height: 170, opacity: 0.3 },
  label: { color: OB.muted, fontSize: 13, fontWeight: '600' },
  skill: { color: COLORS.text, fontSize: 28, fontWeight: '800' },
  stats: { flexDirection: 'row', gap: 8, marginTop: 4 },
  calc: { color: OB.mutedStrong, fontSize: 16, marginTop: 8 },
  story: { color: COLORS.text, fontSize: 15, lineHeight: 23 },
  judge: { flexDirection: 'row', gap: 8 },
  reviewCard: { gap: 10, borderColor: COLORS.warning, backgroundColor: '#1A1608' },
  reviewTitle: { color: COLORS.warning, fontSize: 17, fontWeight: '700' },
});
