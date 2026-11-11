// 확인자 검토: 얼굴 없는 관절 선·통계·AI 참고 요약을 보고 승인 또는 사유와 함께 반려 (JN-019·020·008, US-07·08, API-037~040)
// 확인자 화면에는 얼굴·나이·길드명을 보여 주지 않는다. AI 요약은 참고일 뿐 상태를 바꾸지 않는다.
import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { game } from '../../src/auth/session';
import { repLabel, EXERCISE_NAME, STATUS_TEXT } from '../../src/game/status';
import { SkeletonStrip } from '../../src/game/SkeletonStrip';
import { Card, ErrorBox, H1, Loading, Muted, OB, Page, Pill, SectionTitle, Stat, TopBar, errorMessage, useLoad } from '../../src/game/ui';
import { ErrorText, PillButton } from '../../src/onboarding/ui';
import { COLORS } from '../../src/theme/tokens';

export default function ReviewDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [mode, setMode] = useState<'view' | 'reject'>('view');
  const [code, setCode] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const { data, error, loading, reload, silent } = useLoad(async () => {
    const [d, reasons] = await Promise.all([game.reviewDetail(id), game.rejectReasons()]);
    return { d, reasons };
  }, [id]);

  if (loading) return <Page><TopBar title="확인 자료" /><Loading /></Page>;
  if (!data) return <Page><TopBar title="확인 자료" /><ErrorBox message={error ?? '요청을 찾을 수 없어요.'} onRetry={reload} /></Page>;
  const { d, reasons } = data;
  const open = d.status === 'PENDING_REVIEW';
  const flagged = d.anomalies.flatMap((a) => a.repNos);

  const act = async (kind: 'approve' | 'reject') => {
    setBusy(kind); setActionError(null);
    try {
      if (kind === 'approve') await game.approve(id, d.version);
      else await game.reject(id, d.version, code!, text.trim());
      router.back();
    } catch (e) { setActionError(errorMessage(e)); await silent(); } finally { setBusy(null); }
  };

  return <Page padBottom={20}>
    <TopBar title="확인 자료" />
    <H1>{d.requester.nickname}님의{'\n'}<Text style={{ color: COLORS.primary }}>{EXERCISE_NAME[d.exerciseCode] ?? d.exerciseCode} {d.countedReps}회</Text></H1>
    {!open && <Card><Text style={{ color: COLORS.warning, fontWeight: '700' }}>이미 처리된 요청이에요 · {STATUS_TEXT[d.status].label}</Text></Card>}

    <Card style={{ gap: 12 }}>
      <Text style={styles.k}>관절 선 (얼굴 없음){flagged.length ? ' · 노란색은 AI가 짚은 렙' : ''}</Text>
      <SkeletonStrip count={6} highlight={flagged} />
      <View style={{ flexDirection: 'row' }}>
        <Stat label="인정 횟수" value={d.countedReps} />
        <Stat label="AI 확신도" value={`${Math.round(d.confidence * 100)}%`} />
      </View>
    </Card>

    <SectionTitle>AI 참고 요약</SectionTitle>
    <Card style={{ gap: 10 }}>
      <Text style={styles.v}>{d.summary ?? '요약이 아직 없어요.'}</Text>
      {d.anomalies.map((a, i) => <View key={i} style={styles.anomaly}>
        <Text style={styles.anomalyT}>참고 설명 · {repLabel(a.repNos) || '전체 흐름'}</Text>
        <Text style={styles.v}>{a.description}</Text>
      </View>)}
      <Muted>AI 설명은 참고일 뿐이에요. 승인·반려는 직접 정해 주세요.</Muted>
    </Card>

    {open && mode === 'view' && <>
      <ErrorText>{actionError}</ErrorText>
      <PillButton title="실제로 한 운동이에요 · 승인" loading={busy === 'approve'} disabled={!!busy} onPress={() => act('approve')} />
      <PillButton title="반려하기" variant="secondary" disabled={!!busy} onPress={() => setMode('reject')} />
    </>}

    {open && mode === 'reject' && <Card style={{ gap: 12, borderColor: COLORS.danger }}>
      <Text style={styles.rejectTitle}>반려 사유</Text>
      <View style={styles.pills}>{reasons.map((r) => <Pill key={r.code} label={r.label} selected={code === r.code} onPress={() => setCode(r.code)} />)}</View>
      <TextInput accessibilityLabel="반려 설명" value={text} onChangeText={setText} placeholder="어떤 점이 이상했는지 적어 주세요" placeholderTextColor={OB.dim}
        multiline style={styles.input} maxLength={200} />
      <Muted>반려하면 기록이 종료되고, 신청자는 새로 운동해야 해요.</Muted>
      <ErrorText>{actionError}</ErrorText>
      <PillButton title="사유와 함께 반려" disabled={!code || !text.trim() || !!busy} loading={busy === 'reject'} onPress={() => act('reject')} />
      <PillButton title="돌아가기" variant="text" onPress={() => setMode('view')} />
    </Card>}
  </Page>;
}

const styles = StyleSheet.create({
  k: { color: OB.muted, fontSize: 13 },
  v: { color: COLORS.text, fontSize: 15, lineHeight: 22 },
  anomaly: { backgroundColor: OB.surfaceRaised, borderRadius: 12, padding: 12, gap: 4 },
  anomalyT: { color: COLORS.warning, fontSize: 12, fontWeight: '700' },
  rejectTitle: { color: COLORS.danger, fontSize: 17, fontWeight: '700' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: { minHeight: 90, borderRadius: 12, borderWidth: 1, borderColor: OB.line, backgroundColor: OB.surfaceRaised, color: COLORS.text, padding: 12, fontSize: 15, textAlignVertical: 'top' },
});
