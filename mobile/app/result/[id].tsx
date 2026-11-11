// 전투 리플레이·결과 카드·서사·교정 코멘트 (JN-004·005·017·018·021, US-04·05, API-047·048)
// - 리플레이 콤보 수 = 결과 카드의 타격 수, 30초를 넘지 않고 스킵할 수 있다
// - 타격 수 0(일일 상한 초과)이면 리플레이 없이 '일일 상한 초과' 카드
// - 모션 줄이기 설정이면 바로 결과 카드
import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AccessibilityInfo, Animated, Easing, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { game } from '../../src/auth/session';
import { attackOf, monsterOf } from '../../src/game/assets';
import { ATTACK_LABEL, EXERCISE_NAME, SKILL_NAME, attackKindOf, hoursLeft } from '../../src/game/status';
import { Bar, Card, ErrorBox, Loading, Muted, OB, Page, SectionTitle, Stat, TopBar, useLoad } from '../../src/game/ui';
import { PillButton } from '../../src/onboarding/ui';
import { COLORS } from '../../src/theme/tokens';

const MAX_MS = 25000; // 30초 이내 (US-05)

export default function Result() {
  const { id, targetType, targetId } = useLocalSearchParams<{ id: string; targetType?: string; targetId?: string }>();
  const router = useRouter();
  const [view, setView] = useState<'replay' | 'card'>('replay');
  const { data, error, loading, reload } = useLoad(async () => {
    const [result, replay, character, rewards] = await Promise.all([game.result(id), game.replay(id), game.character(), game.rewards()]);
    return { result, replay, character, reward: rewards.find((r) => r.submissionId === id) ?? null };
  }, [id]);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then((on) => { if (on) setView('card'); });
  }, []);
  useEffect(() => { if (data && data.result.card.hitCount === 0) setView('card'); }, [data]);

  if (loading) return <Page><TopBar title="전투 결과" /><Loading text="전투 기록을 불러오는 중" /></Page>;
  if (!data) return <Page><TopBar title="전투 결과" /><ErrorBox message={error ?? '전투 결과를 볼 수 없어요.'} onRetry={reload} /></Page>;
  const target = targetType === 'BOSS' || targetType === 'DUNGEON' ? { type: targetType as 'BOSS' | 'DUNGEON', id: targetId } : null;

  if (view === 'replay') return <Replay hits={data.result.card.hitCount} damage={data.result.card.totalDamage} skill={SKILL_NAME[data.result.card.exerciseCode] ?? '공격'}
    attack={attackOf(data.character.avatarId, data.result.card.exerciseCode)} kind={ATTACK_LABEL[attackKindOf(data.result.card.exerciseCode)]} monster={monsterOf(target)} onDone={() => setView('card')} />;

  const { card, narrative, formComment } = data.result;
  const protectEnd = data.reward?.protectionEndsAt;
  return <Page padBottom={10}>
    <TopBar title="전투 결과" />
    {card.dailyCapExceeded || card.hitCount === 0 ? <Card style={styles.capCard}>
      <Text style={styles.capTitle}>일일 상한 초과</Text>
      <Muted>오늘 스쿼트 상한(200회)을 다 써서 이 기록은 공격 없이 남았어요. 운동한 기록은 그대로 저장돼요.</Muted>
    </Card> : <Card highlight style={styles.hero}>
      <Image source={monsterOf(target)} style={styles.heroMonster} resizeMode="contain" />
      <Text style={styles.combo}>{card.hitCount}<Text style={styles.comboUnit}> COMBO</Text></Text>
      <Text style={styles.skill}>{SKILL_NAME[card.exerciseCode] ?? '공격'} ×{card.hitCount}</Text>
      <Muted>{EXERCISE_NAME[card.exerciseCode] ?? card.exerciseCode} {card.countedReps}회 인정</Muted>
    </Card>}

    <Card style={styles.stats}>
      <Stat label="타격 수" value={card.hitCount} accent />
      <Stat label="경험치" value={`+${card.exp}`} />
      <Stat label="총 피해" value={card.totalDamage.toLocaleString()} />
    </Card>

    {card.drops.length > 0 && <Card style={{ gap: 10 }}>
      <Text style={styles.label}>얻은 보상 상자 {card.drops.length}개</Text>
      <View style={styles.drops}>{card.drops.map((d) => <View key={d.itemId} style={styles.drop}>
        <Text style={styles.dropIcon}>▣</Text><Text style={styles.dropText}>{d.status === 'LOCKED' ? '잠김' : '열림'}</Text>
      </View>)}</View>
      {protectEnd && <>
        <Bar value={24 - hoursLeft(protectEnd)} max={24} color={COLORS.warning} height={6} label="보호 기간 진행" />
        <Muted>보호 기간 {hoursLeft(protectEnd)}시간 남음 · 끝나면 아이템이 열리고 능력치 경험치가 확정돼요. 그전에는 전투 능력치에 들어가지 않아요.</Muted>
      </>}
    </Card>}

    <SectionTitle>전투 이야기</SectionTitle>
    <Card style={{ gap: 6 }}>
      <Text style={styles.label}>{narrative.isFallback ? '기본 문구' : 'AI 서사'}</Text>
      <Text style={styles.story}>{narrative.text}</Text>
    </Card>

    <SectionTitle>다음에 고칠 점</SectionTitle>
    <Card style={styles.tip}>
      <Text style={[styles.label, { color: COLORS.primary }]}>{formComment.isFallback ? '기본 안내' : 'AI 자세 코멘트'}</Text>
      <Text style={styles.story}>{formComment.text}</Text>
    </Card>

    {card.hitCount > 0 && <PillButton title="리플레이 다시 보기" variant="secondary" onPress={() => setView('replay')} />}
    <PillButton title="홈으로" onPress={() => router.replace('/home')} />
  </Page>;
}

function Replay({ hits, damage, skill, kind, attack, monster, onDone }: { hits: number; damage: number; skill: string; kind: string; attack: number; monster: number; onDone: () => void }) {
  const [combo, setCombo] = useState(0);
  const per = Math.min(650, Math.floor(MAX_MS / Math.max(hits, 1)));
  const dmgPerHit = Math.round(damage / Math.max(hits, 1));
  const shake = useRef(new Animated.Value(0)).current;
  const lunge = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (combo >= hits) { const t = setTimeout(onDone, 1200); return () => clearTimeout(t); }
    const t = setTimeout(() => {
      setCombo((c) => c + 1);
      shake.setValue(0); pop.setValue(0); lunge.setValue(0);
      Animated.parallel([
        Animated.sequence([
          Animated.timing(lunge, { toValue: 1, duration: per * 0.3, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
          Animated.timing(lunge, { toValue: 0, duration: per * 0.4, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.delay(per * 0.25),
          Animated.timing(shake, { toValue: 1, duration: per * 0.15, useNativeDriver: true }),
          Animated.timing(shake, { toValue: -1, duration: per * 0.15, useNativeDriver: true }),
          Animated.timing(shake, { toValue: 0, duration: per * 0.15, useNativeDriver: true }),
        ]),
        Animated.timing(pop, { toValue: 1, duration: per * 0.9, useNativeDriver: true }),
      ]).start();
    }, combo === 0 ? 600 : per);
    return () => clearTimeout(t);
  }, [combo, hits, per, onDone, shake, pop, lunge]);

  const hp = Math.max(0, 1 - combo / Math.max(hits, 1));
  return <SafeAreaView style={styles.replay} edges={['top', 'bottom']}>
    <View style={styles.replayTop}>
      <View><Text style={styles.replayTitle}>{skill}</Text><Text style={styles.replayKind}>{kind} 공격</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel="리플레이 건너뛰기" onPress={onDone} style={styles.skip}><Text style={styles.skipText}>스킵 ›</Text></Pressable>
    </View>
    <View style={styles.enemyHp}><Bar value={hp * 100} max={100} color={COLORS.danger} height={8} label="적 체력" /></View>

    <View style={styles.stage}>
      <View style={styles.floor} />
      <Animated.Image source={monster} resizeMode="contain" accessibilityLabel="적"
        style={[styles.stageMonster, { transform: [{ translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-10, 10] }) }], opacity: combo >= hits ? 0.35 : 1 }]} />
      <Animated.Image source={attack} resizeMode="contain" accessibilityLabel={`내 캐릭터가 ${kind}로 공격`}
        style={[styles.stageHero, { transform: [{ translateX: lunge.interpolate({ inputRange: [0, 1], outputRange: [0, 40] }) }] }]} />
      {combo > 0 && <Animated.Text style={[styles.dmg, {
        opacity: pop.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] }),
        transform: [{ translateY: pop.interpolate({ inputRange: [0, 1], outputRange: [0, -50] }) }],
      }]}>-{dmgPerHit}</Animated.Text>}
    </View>

    <View style={styles.comboBox} accessibilityLiveRegion="polite">
      <Text style={styles.comboBig}>{combo}</Text>
      <Text style={styles.comboLabel}>COMBO</Text>
    </View>
    <Muted center>{combo >= hits ? '전투 끝! 결과를 정리하는 중' : `${hits}번의 운동이 ${hits}번의 공격이 돼요`}</Muted>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  capCard: { gap: 8, borderColor: COLORS.warning, padding: 20 },
  capTitle: { color: COLORS.warning, fontSize: 26, fontWeight: '800' },
  hero: { padding: 20, gap: 4, overflow: 'hidden', minHeight: 170, justifyContent: 'center' },
  heroMonster: { position: 'absolute', right: -20, top: -10, width: 170, height: 200, opacity: 0.35 },
  combo: { color: COLORS.primary, fontSize: 56, lineHeight: 62, fontWeight: '900' },
  comboUnit: { fontSize: 20, fontWeight: '800' },
  skill: { color: COLORS.text, fontSize: 20, fontWeight: '700' },
  stats: { flexDirection: 'row', gap: 8 },
  label: { color: OB.muted, fontSize: 13, fontWeight: '600' },
  drops: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  drop: { width: 64, height: 64, borderRadius: 14, backgroundColor: OB.surfaceRaised, alignItems: 'center', justifyContent: 'center', gap: 2 },
  dropIcon: { color: COLORS.warning, fontSize: 22 },
  dropText: { color: OB.muted, fontSize: 11 },
  story: { color: COLORS.text, fontSize: 16, lineHeight: 24 },
  tip: { gap: 6, borderColor: '#2A3A12', backgroundColor: '#0F140A' },
  replay: { flex: 1, backgroundColor: '#000', paddingHorizontal: 20 },
  replayTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52 },
  replayTitle: { color: COLORS.text, fontSize: 18, fontWeight: '700' },
  replayKind: { color: COLORS.primary, fontSize: 12, fontWeight: '600', marginTop: 2 },
  skip: { minHeight: 44, paddingHorizontal: 16, borderRadius: 999, backgroundColor: OB.surfaceRaised, justifyContent: 'center' },
  skipText: { color: COLORS.text, fontWeight: '700' },
  enemyHp: { marginTop: 8 },
  stage: { flex: 1, justifyContent: 'center' },
  floor: { position: 'absolute', left: -20, right: -20, bottom: '18%', height: 2, backgroundColor: '#B9FD5033' },
  stageMonster: { position: 'absolute', right: -10, bottom: '17%', width: '56%', height: '56%' },
  stageHero: { position: 'absolute', left: -8, bottom: '16%', width: '58%', height: '44%' },
  dmg: { position: 'absolute', right: '22%', top: '22%', color: COLORS.warning, fontSize: 34, fontWeight: '900' },
  comboBox: { alignItems: 'center', marginBottom: 8 },
  comboBig: { color: COLORS.primary, fontSize: 84, lineHeight: 90, fontWeight: '900' },
  comboLabel: { color: COLORS.text, fontSize: 18, fontWeight: '800', letterSpacing: 4 },
});
