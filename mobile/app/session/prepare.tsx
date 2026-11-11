// 운동 준비·튜토리얼: 스쿼트 판정 기준·촬영 각도, 운동 부위 실루엣, 목표 횟수·세트, 공략 대상 (JN-012, US-01, DESIGN.md 3절)
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { DEMO_DUNGEON_ID, type Target } from '../../src/api/game';
import { api, game } from '../../src/auth/session';
import { MONSTERS, MUSCLE_SQUAT } from '../../src/game/assets';
import { Card, ErrorBox, H1, Loading, Muted, OB, Page, SectionTitle, TopBar, useLoad } from '../../src/game/ui';
import { PillButton } from '../../src/onboarding/ui';
import { COLORS } from '../../src/theme/tokens';

const ANGLE_TEXT: Record<string, string> = { SIDE: '옆에서 전신이 보이게', FRONT: '정면에서 전신이 보이게', DIAGONAL: '45도 옆에서 전신이 보이게' };

export default function Prepare() {
  const router = useRouter();
  const [reps, setReps] = useState(30);
  const [sets, setSets] = useState(1);
  const [target, setTarget] = useState<'DUNGEON' | 'BOSS'>('DUNGEON');
  const { data, error, loading, reload } = useLoad(async () => {
    const [ex, caps, me, dungeon] = await Promise.all([game.exercises(), game.dailyCaps(), api.me(), game.dungeon(DEMO_DUNGEON_ID)]);
    const boss = me.guildId ? await game.boss(me.guildId).catch(() => null) : null;
    return { squat: ex.items.find((e) => e.code === 'SQUAT'), cap: caps.items.find((c) => c.exerciseCode === 'SQUAT'), me, dungeon, boss };
  });

  if (loading) return <Page><TopBar title="운동 준비" /><Loading /></Page>;
  if (!data?.squat) return <Page><TopBar title="운동 준비" /><ErrorBox message={error ?? '운동 정보를 불러오지 못했어요.'} onRetry={reload} /></Page>;
  const { squat, cap, me, dungeon, boss } = data;
  const remaining = cap?.remaining ?? squat.dailyCap;
  const targetValue: Target | null = target === 'BOSS' && boss && me.guildId ? { type: 'BOSS', id: me.guildId } : { type: 'DUNGEON', id: DEMO_DUNGEON_ID };

  const start = () => router.push({ pathname: '/session/run', params: { reps: String(reps), sets: String(sets), targetType: targetValue!.type, targetId: targetValue!.id } });

  return <Page padBottom={80}>
    <TopBar title="운동 준비" />
    <H1 accent="스쿼트">오늘의 운동은{'\n'}</H1>
    <Muted>MVP에서는 스쿼트 한 가지만 셀 수 있어요.</Muted>

    <Card style={styles.tutorial}>
      <Image source={MUSCLE_SQUAT} style={styles.muscle} resizeMode="contain" accessibilityLabel="스쿼트로 쓰는 부위: 허벅지 앞·뒤, 엉덩이, 종아리" />
      <View style={{ flex: 1, gap: 12 }}>
        <Text style={styles.tag}>주로 쓰는 부위</Text>
        <Text style={styles.parts}>허벅지 앞·뒤{'\n'}엉덩이 · 종아리</Text>
        <View style={styles.rule}><Text style={styles.ruleK}>인정 기준</Text><Text style={styles.ruleV}>무릎 각도 {squat.criteria.kneeAngleMax ?? 90}° 이하까지 앉기</Text></View>
        <View style={styles.rule}><Text style={styles.ruleK}>촬영 각도</Text><Text style={styles.ruleV}>{ANGLE_TEXT[squat.recommendedCameraAngle ?? ''] ?? squat.recommendedCameraAngle ?? '전신이 보이게'}</Text></View>
      </View>
    </Card>

    <SectionTitle>목표</SectionTitle>
    <Card style={{ gap: 14 }}>
      <Stepper label="횟수" value={reps} unit="회" step={5} min={5} max={100} onChange={setReps} />
      <View style={styles.sep} />
      <Stepper label="세트" value={sets} unit="세트" step={1} min={1} max={5} onChange={setSets} />
      <Muted>오늘 남은 상한 {remaining}회 · 넘는 횟수는 보상 없이 기록만 남아요.</Muted>
    </Card>

    <SectionTitle>공략 대상</SectionTitle>
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <TargetCard image={MONSTERS.beak} title={dungeon.enemy.name} sub={dungeon.name} selected={target === 'DUNGEON'} onPress={() => setTarget('DUNGEON')} />
      <TargetCard image={MONSTERS.reaper} title="주간 보스" sub={boss ? `HP ${boss.hp.toLocaleString()}` : '길드 가입 후 가능'} selected={target === 'BOSS'} disabled={!boss} onPress={() => setTarget('BOSS')} />
    </View>

    <Card style={styles.notice}>
      <Text style={styles.noticeTitle}>영상은 기기 밖으로 나가지 않아요</Text>
      <Muted>얼굴을 뺀 관절 좌표와 렙 시각만 서버로 보내요. 시작할 때 화면이 지시하는 동작을 한 번 따라 해 주세요.</Muted>
    </Card>

    <PillButton title={`스쿼트 ${reps}회 × ${sets}세트 시작`} arrow onPress={start} />
  </Page>;
}

function Stepper({ label, value, unit, step, min, max, onChange }: { label: string; value: number; unit: string; step: number; min: number; max: number; onChange: (v: number) => void }) {
  return <View style={styles.stepper}>
    <Text style={styles.stepLabel}>{label}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label} 줄이기`} onPress={() => onChange(Math.max(min, value - step))} style={styles.stepBtn}><Text style={styles.stepBtnText}>−</Text></Pressable>
    <Text accessibilityLiveRegion="polite" style={styles.stepValue}>{value}<Text style={styles.stepUnit}> {unit}</Text></Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label} 늘리기`} onPress={() => onChange(Math.min(max, value + step))} style={styles.stepBtn}><Text style={styles.stepBtnText}>+</Text></Pressable>
  </View>;
}

function TargetCard({ image, title, sub, selected, disabled, onPress }: { image: number; title: string; sub: string; selected: boolean; disabled?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="radio" accessibilityState={{ selected, disabled: !!disabled }} accessibilityLabel={`${title}, ${sub}`} disabled={disabled} onPress={onPress}
    style={[styles.target, selected && styles.targetOn, disabled && { opacity: 0.45 }]}>
    <Image source={image} style={styles.targetImg} resizeMode="contain" />
    <Text style={styles.targetTitle}>{title}</Text>
    <Text style={styles.targetSub}>{sub}</Text>
    <View style={[styles.radio, selected && { borderColor: COLORS.primary }]}>{selected && <View style={styles.radioDot} />}</View>
  </Pressable>;
}

const styles = StyleSheet.create({
  tutorial: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 20 },
  muscle: { width: 110, height: 190 },
  tag: { color: COLORS.primary, fontSize: 13, fontWeight: '600' },
  parts: { color: COLORS.text, fontSize: 18, lineHeight: 26, fontWeight: '700' },
  rule: { gap: 2 },
  ruleK: { color: OB.muted, fontSize: 12 },
  ruleV: { color: COLORS.text, fontSize: 14, lineHeight: 20 },
  sep: { height: 1, backgroundColor: OB.surfaceRaised },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepLabel: { color: OB.mutedStrong, fontSize: 15, flex: 1 },
  stepBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: OB.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { color: COLORS.text, fontSize: 22, fontWeight: '600' },
  stepValue: { color: COLORS.text, fontSize: 26, fontWeight: '800', minWidth: 96, textAlign: 'center' },
  stepUnit: { color: OB.muted, fontSize: 14, fontWeight: '500' },
  target: { flex: 1, backgroundColor: OB.surface, borderRadius: 18, padding: 14, borderWidth: 1.5, borderColor: OB.surface, gap: 2 },
  targetOn: { borderColor: COLORS.primary },
  targetImg: { width: '100%', height: 120, marginBottom: 6 },
  targetTitle: { color: COLORS.text, fontSize: 16, fontWeight: '700' },
  targetSub: { color: OB.muted, fontSize: 13 },
  radio: { position: 'absolute', top: 12, right: 12, width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: OB.dim, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },
  notice: { gap: 6, backgroundColor: '#0F140A', borderColor: '#2A3A12' },
  noticeTitle: { color: COLORS.primary, fontSize: 15, fontWeight: '700' },
});
