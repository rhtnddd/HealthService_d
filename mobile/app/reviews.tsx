// 받은 확인 요청 목록 (JN-020, US-07·08, API-036)
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { game } from '../src/auth/session';
import { EXERCISE_NAME, kstDateTime } from '../src/game/status';
import { Card, Empty, ErrorBox, Eyebrow, H1, Loading, Muted, OB, Page, useLoad } from '../src/game/ui';
import { COLORS } from '../src/theme/tokens';

export default function Reviews() {
  const router = useRouter();
  const { data, error, loading, refreshing, reload } = useLoad(() => game.receivedReviews());
  return <Page tab onRefresh={reload} refreshing={refreshing}>
    <View style={{ gap: 6, marginTop: 8 }}>
      <Eyebrow>확인자</Eyebrow>
      <H1>받은 확인 요청</H1>
      <Muted>AI가 애매하다고 본 길드원의 기록이에요. 관절 선과 통계를 보고 실제로 한 운동인지 판단해 주세요.</Muted>
    </View>
    {loading ? <Loading /> : error && !data ? <ErrorBox message={error} onRetry={reload} /> :
      !data?.length ? <Empty title="받은 확인 요청이 없어요" body="길드원이 확인을 요청하면 여기에 나타나요." /> :
        data.map((r) => <Card key={r.submissionId} onPress={() => router.push({ pathname: '/review/[id]', params: { id: r.submissionId } })} label={`${r.requester.nickname}님의 요청 열기`} style={styles.item}>
          <View style={styles.badge}><Text style={styles.badgeText}>!</Text></View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={styles.title}>{r.requester.nickname}님 · {EXERCISE_NAME[r.exerciseCode] ?? r.exerciseCode} {r.countedReps}회</Text>
            <Muted>{kstDateTime(r.requestedAt)} 요청</Muted>
          </View>
          <Text style={styles.go}>확인 →</Text>
        </Card>)}
  </Page>;
}

const styles = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  badge: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#2A2410', alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: COLORS.warning, fontWeight: '900', fontSize: 16 },
  title: { color: COLORS.text, fontSize: 16, fontWeight: '600' },
  go: { color: OB.accent, fontWeight: '700' },
});
