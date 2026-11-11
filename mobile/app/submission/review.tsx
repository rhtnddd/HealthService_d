// 확인 요청 미리보기: 보낼 내용 확인 → 지인·길드장 1명 선택 → 보내기 (JN-007, US-07, API-017·034·035)
import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { game } from '../../src/auth/session';
import { repLabel, EXERCISE_NAME } from '../../src/game/status';
import { Card, Empty, ErrorBox, H1, Loading, Muted, OB, Page, SectionTitle, TopBar, errorMessage, useLoad } from '../../src/game/ui';
import { ErrorText, PillButton } from '../../src/onboarding/ui';
import { COLORS } from '../../src/theme/tokens';
import { SkeletonStrip } from '../../src/game/SkeletonStrip';

export default function ReviewRequest() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [picked, setPicked] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const { data, error, loading, reload } = useLoad(async () => {
    const [s, share, people] = await Promise.all([game.submission(id), game.sharePreview(id), game.acquaintances()]);
    return { s, share, people };
  }, [id]);

  if (loading) return <Page><TopBar title="확인 요청" /><Loading /></Page>;
  if (!data) return <Page><TopBar title="확인 요청" /><ErrorBox message={error ?? '불러오지 못했어요.'} onRetry={reload} /></Page>;
  const { s, share, people } = data;

  const send = async () => {
    if (!picked) return;
    setBusy(true); setSendError(null);
    try {
      const latest = await game.submission(id); // 동시 수정 검사용 최신 version (If-Match)
      await game.requestReview(id, latest.version, picked);
      router.back();
    } catch (e) { setSendError(errorMessage(e)); } finally { setBusy(false); }
  };

  return <Page padBottom={20}>
    <TopBar title="확인 요청" />
    <H1 accent="미리 확인해 주세요">보낼 내용을{'\n'}</H1>
    <Muted>확인자에게는 아래 내용만 보여요. 얼굴·영상·나이·길드명은 보내지 않아요.</Muted>

    <Card style={{ gap: 12 }}>
      <Text style={styles.k}>관절 선 (얼굴 없음)</Text>
      <SkeletonStrip count={Math.min(6, s.countedReps || 6)} />
      <View style={styles.row}><Text style={styles.k}>운동</Text><Text style={styles.v}>{EXERCISE_NAME[s.exerciseCode] ?? s.exerciseCode} {s.countedReps}회</Text></View>
      <View style={styles.row}><Text style={styles.k}>AI 참고 요약</Text><Text style={[styles.v, { flex: 1, textAlign: 'right' }]}>{share.summary ?? '요약을 준비 중이에요'}</Text></View>
      {share.anomalies.map((a, i) => <View key={i} style={styles.anomaly}><Text style={styles.anomalyT}>AI 참고 설명 · {repLabel(a.repNos) || '전체 흐름'}</Text><Text style={styles.v}>{a.description}</Text></View>)}
    </Card>

    <SectionTitle>확인자 고르기</SectionTitle>
    {people.length === 0 ? <Empty title="고를 수 있는 사람이 없어요" body="같은 길드원에게만 확인을 요청할 수 있어요. 길드에 먼저 가입해 주세요." /> :
      people.map((p) => {
        const on = picked === p.userId;
        return <Pressable key={p.userId} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => setPicked(p.userId)} style={[styles.person, on && styles.personOn]}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{p.nickname.slice(0, 1)}</Text></View>
          <View style={{ flex: 1 }}><Text style={styles.name}>{p.nickname}</Text><Text style={styles.rel}>{p.relation === 'GUILD_LEADER' ? '길드장' : '길드원'}</Text></View>
          <View style={[styles.radio, on && { borderColor: COLORS.primary }]}>{on && <View style={styles.radioDot} />}</View>
        </Pressable>;
      })}

    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: confirmed }} onPress={() => setConfirmed(!confirmed)} style={styles.check}>
      <View style={[styles.box, confirmed && styles.boxOn]}>{confirmed && <Text style={styles.tick}>✓</Text>}</View>
      <Text style={styles.checkText}>위 내용을 확인했고, 이 내용만 보내는 데 동의해요</Text>
    </Pressable>
    <ErrorText>{sendError}</ErrorText>
    <PillButton title="확인 요청 보내기" disabled={!picked || !confirmed} loading={busy} onPress={send} />
  </Page>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  k: { color: OB.muted, fontSize: 13 },
  v: { color: COLORS.text, fontSize: 14, lineHeight: 20 },
  anomaly: { backgroundColor: OB.surfaceRaised, borderRadius: 12, padding: 12, gap: 4 },
  anomalyT: { color: COLORS.warning, fontSize: 12, fontWeight: '700' },
  person: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: OB.surface, borderRadius: 16, padding: 14, borderWidth: 1.5, borderColor: OB.surface },
  personOn: { borderColor: COLORS.primary },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: OB.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: COLORS.primary, fontSize: 16, fontWeight: '700' },
  name: { color: COLORS.text, fontSize: 16, fontWeight: '600' },
  rel: { color: OB.muted, fontSize: 13 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: OB.dim, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },
  check: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  box: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: OB.dim, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tick: { color: '#000', fontWeight: '900' },
  checkText: { color: OB.mutedStrong, fontSize: 14, flex: 1 },
});
