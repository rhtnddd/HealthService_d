// 홈: 캐릭터 요약, 공략 대상, 오늘 상한, 전투 결과 도착 카드, 최근 기록 (DESIGN.md 3절 '홈', 기능명세 JN-001·005·010)
import { useRouter } from 'expo-router';
import { Image, StyleSheet, Text, View } from 'react-native';
import { DEMO_DUNGEON_ID } from '../src/api/game';
import { api, game } from '../src/auth/session';
import { MONSTERS, avatarImageOf } from '../src/game/assets';
import { EXERCISE_NAME, STATUS_TEXT, kstDateTime } from '../src/game/status';
import { Bar, Card, Empty, ErrorBox, Eyebrow, Loading, Muted, OB, Page, SectionTitle, StatusChip, useLoad } from '../src/game/ui';
import { PillButton } from '../src/onboarding/ui';
import { COLORS } from '../src/theme/tokens';

export default function Home() {
  const router = useRouter();
  const { data, error, loading, refreshing, reload } = useLoad(async () => {
    const [me, character, dungeon, caps, subs] = await Promise.all([
      api.me(), game.character(), game.dungeon(DEMO_DUNGEON_ID), game.dailyCaps(), game.mySubmissions(10),
    ]);
    return { me, character, dungeon, cap: caps.items.find((c) => c.exerciseCode === 'SQUAT'), subs };
  });

  if (loading) return <Page tab><Loading /></Page>;
  if (!data) return <Page tab><ErrorBox message={error ?? '불러오지 못했어요.'} onRetry={reload} /></Page>;
  const { me, character, dungeon, cap, subs } = data;
  const arrived = subs.filter((s) => s.status === 'REWARDED').slice(0, 2);
  const pending = subs.filter((s) => s.status === 'PREPARED' || s.status === 'PENDING_REVIEW' || s.status === 'SUBMITTED' || s.status === 'APPROVED');

  return <Page tab onRefresh={reload} refreshing={refreshing}>
    <View style={styles.header}>
      <View style={{ flex: 1, gap: 4 }}>
        <Eyebrow>전지적 운동 시점</Eyebrow>
        <Text style={styles.hello}>{me.nickname}님,{'\n'}오늘도 <Text style={{ color: COLORS.primary }}>싸워 볼까요?</Text></Text>
      </View>
      <View style={styles.avatarRing}><Image source={avatarImageOf(character.avatarId)} style={styles.avatar} resizeMode="contain" accessibilityLabel="내 캐릭터" /></View>
    </View>

    {error && <ErrorBox message={error} onRetry={reload} />}

    <Card style={styles.hero}>
      <Image source={MONSTERS.beak} style={styles.monster} resizeMode="contain" accessibilityLabel={`공략 대상 ${dungeon.enemy.name}`} />
      <View style={{ gap: 8, width: '58%' }}>
        <Text style={styles.heroTag}>{dungeon.name}</Text>
        <Text style={styles.heroName}>{dungeon.enemy.name}</Text>
        <Text style={styles.hp}>HP {dungeon.enemy.hp.toLocaleString()} / {dungeon.enemy.hpMax.toLocaleString()}</Text>
        <Bar value={dungeon.enemy.hp} max={dungeon.enemy.hpMax} color={COLORS.danger} label="적 체력" />
        <Text style={styles.heroSub}>내 누적 피해 <Text style={{ color: COLORS.primary }}>{dungeon.myProgress.totalDamage.toLocaleString()}</Text></Text>
      </View>
      <View style={{ marginTop: 34 }}>
        <PillButton title="운동 시작하기" arrow onPress={() => router.push('/session/prepare')} />
      </View>
    </Card>

    <Card style={{ gap: 10 }}>
      <View style={styles.row}>
        <Text style={styles.cardTitle}>오늘 스쿼트</Text>
        <Text style={styles.cardValue}>{cap?.reserved ?? 0}<Text style={styles.cardMax}> / {cap?.cap ?? 200}회</Text></Text>
      </View>
      <Bar value={cap?.reserved ?? 0} max={cap?.cap ?? 200} label="오늘 스쿼트 상한 사용량" />
      <Muted>하루 상한을 넘은 횟수는 기록만 남고 보상은 없어요.</Muted>
    </Card>

    {arrived.length > 0 && <>
      <SectionTitle>전투 결과 도착</SectionTitle>
      {arrived.map((s) => <Card key={s.id} highlight onPress={() => router.push({ pathname: '/result/[id]', params: { id: s.id } })} label="전투 결과 보기" style={styles.arrive}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.arriveTitle}>{EXERCISE_NAME[s.exerciseCode] ?? s.exerciseCode} {s.countedReps}회 → {s.reservedReps} COMBO</Text>
          <Muted>{kstDateTime(s.endedAt)} · 리플레이를 볼 수 있어요</Muted>
        </View>
        <Text style={styles.go}>보기 →</Text>
      </Card>)}
    </>}

    <SectionTitle right={pending.length ? <Text style={styles.badge}>진행 중 {pending.length}</Text> : undefined}>최근 기록</SectionTitle>
    {subs.length === 0 ? <Empty title="아직 운동 기록이 없어요" body="운동을 시작하면 기록이 여기에 쌓여요." /> :
      subs.slice(0, 6).map((s) => <Card key={s.id} onPress={() => router.push({ pathname: '/submission/[id]', params: { id: s.id } })} label={`${STATUS_TEXT[s.status].label} 기록 열기`} style={styles.item}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.itemTitle}>{EXERCISE_NAME[s.exerciseCode] ?? s.exerciseCode} {s.countedReps}회</Text>
          <Muted>{kstDateTime(s.startedAt)}</Muted>
        </View>
        <StatusChip status={s.status} />
      </Card>)}
  </Page>;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  hello: { color: COLORS.text, fontSize: 26, lineHeight: 35, fontWeight: '700' },
  avatarRing: { width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: COLORS.primary, overflow: 'hidden', backgroundColor: OB.surface, alignItems: 'center' },
  avatar: { width: 72, height: 150, marginTop: -2 },
  hero: { padding: 20, overflow: 'hidden', borderColor: OB.surfaceRaised },
  monster: { position: 'absolute', right: -6, top: 4, width: 150, height: 190 },
  heroTag: { color: OB.muted, fontSize: 13 },
  heroName: { color: COLORS.text, fontSize: 30, fontWeight: '800' },
  hp: { color: COLORS.danger, fontSize: 13, fontWeight: '600' },
  heroSub: { color: OB.mutedStrong, fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  cardTitle: { color: COLORS.text, fontSize: 16, fontWeight: '600' },
  cardValue: { color: COLORS.primary, fontSize: 22, fontWeight: '800' },
  cardMax: { color: OB.muted, fontSize: 14, fontWeight: '500' },
  arrive: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#B9FD500F' },
  arriveTitle: { color: COLORS.text, fontSize: 16, fontWeight: '700' },
  go: { color: COLORS.primary, fontWeight: '700' },
  badge: { color: COLORS.warning, fontSize: 13, fontWeight: '600' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  itemTitle: { color: COLORS.text, fontSize: 16, fontWeight: '600' },
});
