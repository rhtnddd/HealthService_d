// 캐릭터: 레벨·경험치(확정/확정 대기), 잠긴 아이템, 지급 내역, 로그아웃 (JN-010·021, US-04, API-007·043·044)
import { useRouter } from 'expo-router';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { api, game, logout } from '../src/auth/session';
import { avatarImageOf } from '../src/game/assets';
import { hoursLeft, kstDateTime } from '../src/game/status';
import { Bar, Card, Empty, ErrorBox, Loading, Muted, OB, Page, SectionTitle, Stat, useLoad } from '../src/game/ui';
import { PillButton } from '../src/onboarding/ui';
import { COLORS } from '../src/theme/tokens';

export default function CharacterPage() {
  const router = useRouter();
  const { data, error, loading, refreshing, reload } = useLoad(async () => {
    const [me, c, items, rewards] = await Promise.all([api.me(), game.character(), game.inventory(), game.rewards()]);
    return { me, c, items, rewards };
  });
  if (loading) return <Page tab><Loading /></Page>;
  if (!data) return <Page tab><ErrorBox message={error ?? '불러오지 못했어요.'} onRetry={reload} /></Page>;
  const { me, c, items, rewards } = data;
  const total = c.exp.confirmed + c.exp.pending;

  const signOut = () => Alert.alert('로그아웃할까요?', '다시 들어오려면 이메일과 비밀번호를 입력해야 해요.', [
    { text: '취소', style: 'cancel' },
    { text: '로그아웃', style: 'destructive', onPress: async () => { await logout(); if (router.canDismiss()) router.dismissAll(); router.replace('/'); } },
  ]);

  return <Page tab onRefresh={reload} refreshing={refreshing}>
    <View style={styles.topRow}>
      <Text style={styles.topTitle}>내 캐릭터</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="로그아웃" onPress={signOut} style={styles.logout} hitSlop={6}>
        <Text style={styles.logoutText}>로그아웃</Text>
      </Pressable>
    </View>
    <View style={styles.hero}>
      <View style={styles.glow} />
      <Image source={avatarImageOf(c.avatarId)} style={styles.avatar} resizeMode="contain" accessibilityLabel="내 캐릭터" />
      <View style={styles.level}><Text style={styles.levelText}>Lv. {c.level}</Text></View>
      <Text style={styles.name}>{me.nickname}</Text>
    </View>

    <Card style={{ gap: 10 }}>
      <View style={styles.row}><Text style={styles.k}>경험치</Text><Text style={styles.v}>{c.exp.confirmed.toLocaleString()}{c.exp.pending ? <Text style={{ color: COLORS.warning }}>  +{c.exp.pending} 확정 대기</Text> : null}</Text></View>
      <Bar value={c.exp.confirmed} max={Math.max(total, 1)} label="확정 경험치" />
      <Muted>지급 후 24시간이 지나면 확정 대기 경험치가 확정돼요. 확정 전에는 전투 계산에 들어가지 않아요.</Muted>
    </Card>

    <Card style={styles.stats}>
      <Stat label="레벨" value={c.level} accent />
      <Stat label="잠긴 아이템" value={c.lockedItemCount} />
      <Stat label="받은 보상" value={rewards.length} />
    </Card>

    <SectionTitle>인벤토리</SectionTitle>
    {items.length === 0 ? <Empty title="아직 아이템이 없어요" body="운동 보상으로 상자를 얻을 수 있어요." /> :
      <View style={styles.grid}>{items.map((it) => <View key={it.itemId} style={[styles.item, it.status !== 'LOCKED' && { borderColor: COLORS.primary }]}
        accessibilityLabel={it.status === 'LOCKED' ? `잠긴 상자, ${hoursLeft(it.unlockAt)}시간 뒤 열림` : '열린 상자'}>
        <Text style={[styles.itemIcon, it.status !== 'LOCKED' && { color: COLORS.primary }]}>▣</Text>
        <Text style={styles.itemText}>{it.status === 'LOCKED' ? `${hoursLeft(it.unlockAt)}시간` : '열림'}</Text>
      </View>)}</View>}

    <SectionTitle>지급 내역</SectionTitle>
    {rewards.length === 0 ? <Empty title="아직 지급된 보상이 없어요" /> : rewards.slice(0, 8).map((r) => <Card key={r.submissionId} style={styles.reward}
      onPress={() => router.push({ pathname: '/result/[id]', params: { id: r.submissionId } })} label="전투 결과 열기">
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.v}>경험치 +{r.exp} · 피해 {r.damage.toLocaleString()}</Text>
        <Muted>{kstDateTime(r.rewardedAt)} · 상자 {r.items.length}개</Muted>
      </View>
      <Text style={styles.go}>›</Text>
    </Card>)}

    <PillButton title="로그아웃" variant="secondary" onPress={signOut} />
  </Page>;
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  topTitle: { color: COLORS.text, fontSize: 20, fontWeight: '700' },
  logout: { minHeight: 40, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1, borderColor: OB.line, justifyContent: 'center' },
  logoutText: { color: OB.mutedStrong, fontSize: 14, fontWeight: '600' },
  hero: { alignItems: 'center', paddingTop: 0, gap: 6 },
  glow: { position: 'absolute', top: 40, width: 240, height: 240, borderRadius: 120, backgroundColor: '#B9FD5018' },
  avatar: { width: 220, height: 280 },
  level: { backgroundColor: COLORS.primary, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 4, marginTop: -10 },
  levelText: { color: '#000', fontWeight: '800' },
  name: { color: COLORS.text, fontSize: 26, fontWeight: '800' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  k: { color: OB.muted, fontSize: 14 },
  v: { color: COLORS.text, fontSize: 16, fontWeight: '600' },
  stats: { flexDirection: 'row', gap: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  item: { width: 72, height: 72, borderRadius: 16, backgroundColor: OB.surface, borderWidth: 1, borderColor: OB.surfaceRaised, alignItems: 'center', justifyContent: 'center', gap: 2 },
  itemIcon: { color: COLORS.warning, fontSize: 24 },
  itemText: { color: OB.muted, fontSize: 11 },
  reward: { flexDirection: 'row', alignItems: 'center' },
  go: { color: OB.muted, fontSize: 22 },
});
