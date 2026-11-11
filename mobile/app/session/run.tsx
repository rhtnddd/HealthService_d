// 카메라 운동: 무작위 동작 확인 → 렙 인식·즉시 피드백 → 일시중지·재개 → 제출 (JN-013·014·016·001, US-01)
//
// [임시] 카메라 자세 인식은 개발 빌드에서만 돌아서(STACK.md), 지금은 '데모 인식'이 스쿼트 동작과
// 관절 좌표를 흉내 낸다. 서버로 가는 데이터 형식(API-021·022·026)은 실제와 같다.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppState, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, G, Line, Rect } from 'react-native-svg';
import { uuid, type StartedSession, type Target } from '../../src/api/game';
import { game } from '../../src/auth/session';
import { LIVENESS_LABEL, buildChunks, demoConfidence, demoRepCounted, poseAt, toRepIn } from '../../src/game/workout';
import { errorMessage, OB } from '../../src/game/ui';
import { ErrorText, PillButton } from '../../src/onboarding/ui';
import { COLORS } from '../../src/theme/tokens';

type Phase = 'starting' | 'liveness' | 'counting' | 'paused' | 'submitting' | 'failed';
type Rep = { ts: number; counted: boolean };
const REP_MS = 1800;

export default function Run() {
  const router = useRouter();
  const p = useLocalSearchParams<{ reps: string; sets: string; targetType: Target['type']; targetId: string }>();
  const goal = Number(p.reps ?? 30) * Number(p.sets ?? 1);
  const target: Target | null = p.targetType && p.targetId ? { type: p.targetType, id: p.targetId } : null;

  const [phase, setPhase] = useState<Phase>('starting');
  const [session, setSession] = useState<StartedSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [liveLeft, setLiveLeft] = useState(10);
  const [livenessPassed, setLivenessPassed] = useState<boolean | null>(null);
  const [reps, setReps] = useState<Rep[]>([]);
  const [shaky, setShaky] = useState(false);
  const [clock, setClock] = useState(0); // 애니메이션 시계(ms)
  const startedAt = useRef(Date.now());
  const submitKey = useRef(uuid()); // 같은 세션을 다시 보내도 한 번만 접수 (JN-016)
  const phaseRef = useRef(phase); phaseRef.current = phase;

  // 1) 세션 시작 (API-020)
  const start = useCallback(async () => {
    setError(null); setPhase('starting');
    try {
      const s = await game.startSession({ exerciseCode: 'SQUAT', goal: { reps: Number(p.reps ?? 30), sets: Number(p.sets ?? 1) }, target });
      startedAt.current = Date.now();
      setSession(s); setLiveLeft(s.liveness.timeoutSec); setPhase('liveness');
    } catch (e) { setError(errorMessage(e)); setPhase('failed'); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { void start(); }, [start]);

  // 2) 무작위 동작 확인 (API-021). 데모 인식은 2.5초 뒤 동작을 감지한다
  const sendLiveness = useCallback(async (detected: string) => {
    if (!session) return;
    try {
      const r = await game.liveness(session.sessionId, { challengeId: session.liveness.challengeId, detectedAction: detected, score: 0.95, detectedAt: new Date().toISOString() });
      setLivenessPassed(r.passed);
    } catch (e) { setLivenessPassed(false); setError(errorMessage(e)); }
    setPhase('counting');
  }, [session]);
  useEffect(() => {
    if (phase !== 'liveness') return;
    const t = setInterval(() => setLiveLeft((v) => Math.max(0, v - 1)), 1000);
    const auto = setTimeout(() => session && void sendLiveness(session.liveness.action), 2500);
    return () => { clearInterval(t); clearTimeout(auto); };
  }, [phase, session, sendLiveness]);

  // 3) 렙 세기 (데모 인식). REP_MS마다 한 번 앉았다 일어난다
  useEffect(() => {
    if (phase !== 'counting' && phase !== 'liveness') return;
    const t = setInterval(() => setClock((c) => c + 50), 50);
    return () => clearInterval(t);
  }, [phase]);
  useEffect(() => {
    if (phase !== 'counting' || reps.length >= goal) return;
    const t = setInterval(() => setReps((rs) => rs.length >= goal ? rs : [...rs, { ts: Date.now(), counted: demoRepCounted(rs.length + 1, shaky) }]), REP_MS);
    return () => clearInterval(t);
  }, [phase, shaky, goal, reps.length >= goal]);

  // 앱이 백그라운드로 가면 일시중지한다. 불완전 기록은 자동 제출하지 않는다 (API-023, STACK.md 추가 검증 항목)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st !== 'active' && phaseRef.current === 'counting' && session) void pause('APP_BACKGROUND');
    });
    return () => sub.remove();
  });

  const pause = async (reason: 'CAMERA_LOST' | 'APP_BACKGROUND') => {
    if (!session) return;
    setPhase('paused');
    try { await game.pause(session.sessionId, reason); } catch (e) { setError(errorMessage(e)); }
  };
  const resume = async () => {
    if (!session) return;
    try { await game.resume(session.sessionId); setError(null); setPhase('counting'); } catch (e) { setError(errorMessage(e)); }
  };
  const quit = async () => {
    if (session) await game.discard(session.sessionId).catch(() => undefined); // 폐기 (API-027)
    router.back();
  };

  // 4) 제출: 좌표 청크 업로드(API-022) → 제출(API-026). 실패하면 같은 키로 다시 보낸다
  const submit = async () => {
    if (!session) return;
    setError(null); setPhase('submitting');
    try {
      const end = Date.now();
      const chunks = buildChunks(startedAt.current, reps, end, session.chunkSpec.maxFrames);
      for (let i = 0; i < chunks.length; i++) await game.uploadChunk(session.sessionId, i + 1, chunks[i]);
      const counted = reps.filter((r) => r.counted).length;
      const res = await game.submit(session.sessionId, submitKey.current, {
        totalChunks: chunks.length, endedAt: new Date(end).toISOString(), clientRepCount: counted,
        reps: toRepIn(reps), aiConfidence: demoConfidence(counted, reps.length, shaky),
      });
      router.replace({ pathname: '/submission/[id]', params: { id: res.submissionId, targetType: target?.type ?? '', targetId: target?.id ?? '' } });
    } catch (e) { setError(errorMessage(e)); setPhase('failed'); }
  };

  const counted = reps.filter((r) => r.counted).length;
  const last = reps[reps.length - 1];
  const cycle = (clock % REP_MS) / REP_MS;
  const depth = phase === 'counting' && reps.length < goal ? Math.sin(cycle * Math.PI) : 0;
  const raise = phase === 'liveness' ? session?.liveness.action ?? null : null;
  const done = reps.length >= goal;

  return <SafeAreaView style={styles.page} edges={['top', 'bottom']}>
    <View style={styles.top}>
      <Pressable accessibilityRole="button" onPress={quit} hitSlop={8} style={styles.quit}><Text style={styles.quitText}>그만두기</Text></Pressable>
      <View style={styles.demoTag}><View style={styles.rec} /><Text style={styles.demoText}>데모 인식 · 영상 저장 안 함</Text></View>
    </View>

    {/* 카메라 영역: 지금은 관절선만 그린다 */}
    <View style={styles.camera} accessible accessibilityLabel={phase === 'liveness' ? '무작위 동작 확인 중' : `인정 ${counted}회`}>
      <Skeleton depth={depth} raise={raise} />
      <Corners />
      {phase === 'liveness' && session && <View style={styles.livePanel}>
        <Text style={styles.liveTitle}>본인 확인 동작</Text>
        <Text style={styles.liveAction}>{LIVENESS_LABEL[session.liveness.action] ?? session.liveness.action}</Text>
        <Text style={styles.liveLeft}>{liveLeft}초 안에</Text>
      </View>}
      {(phase === 'counting' || phase === 'paused') && <View style={styles.counterPanel}>
        <Text style={styles.counter} accessibilityLiveRegion="polite">{counted}<Text style={styles.counterGoal}> / {goal}</Text></Text>
        {last && <Text style={[styles.feedback, { color: last.counted ? COLORS.primary : COLORS.danger }]}>
          {last.counted ? `${reps.length}번째 인정` : `${reps.length}번째 미인정 · 무릎을 더 굽혀 주세요`}
        </Text>}
      </View>}
      {phase === 'paused' && <View style={styles.pausedCover}><Text style={styles.pausedText}>일시중지됨</Text><Text style={styles.pausedSub}>재개하면 이어서 셀게요</Text></View>}
    </View>

    <View style={styles.bottom}>
      {livenessPassed === false && <Text style={styles.warn}>본인 확인 동작을 확인하지 못했어요. 이번 기록은 자동 승인되지 않고 확인 요청으로 넘어가요.</Text>}
      <ErrorText>{error}</ErrorText>
      {phase === 'starting' && <PillButton title="준비 중" loading onPress={() => undefined} />}
      {phase === 'liveness' && <PillButton title="동작을 인식하는 중" loading onPress={() => undefined} />}
      {(phase === 'counting' || phase === 'paused') && <>
        <View style={styles.tools}>
          <View style={styles.shaky}><Switch value={shaky} onValueChange={setShaky} trackColor={{ true: COLORS.warning, false: OB.surfaceRaised }} accessibilityLabel="흔들리는 자세 흉내" />
            <Text style={styles.shakyText}>흔들리는 자세 흉내{'\n'}<Text style={{ color: OB.dim }}>확신도가 낮아져 확인 요청 흐름을 볼 수 있어요</Text></Text></View>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>{phase === 'paused' ? <PillButton title="재개" variant="secondary" onPress={resume} /> : <PillButton title="일시중지" variant="secondary" onPress={() => pause('CAMERA_LOST')} />}</View>
          <View style={{ flex: 1.4 }}><PillButton title={done ? '목표 달성! 제출' : '종료하고 제출'} disabled={phase === 'paused' || reps.length === 0} onPress={submit} /></View>
        </View>
      </>}
      {phase === 'submitting' && <PillButton title="기록 전송 중" loading onPress={() => undefined} />}
      {phase === 'failed' && (session && reps.length > 0
        ? <PillButton title="같은 기록 다시 보내기" onPress={submit} />
        : <PillButton title="다시 시작" onPress={start} />)}
    </View>
  </SafeAreaView>;
}

const BONES: [number, number][] = [[5, 6], [5, 7], [7, 9], [6, 8], [8, 10], [5, 11], [6, 12], [11, 12], [11, 13], [13, 15], [12, 14], [14, 16]];

function Skeleton({ depth, raise }: { depth: number; raise: string | null }) {
  const kp = poseAt(depth).map((k) => k ? [k[0], k[1]] as [number, number] : null);
  // 동작 확인: 손을 머리 위로
  const lift = (i: number) => { kp[i] = [kp[i]![0], 0.04]; };
  if (raise === 'RAISE_LEFT_HAND' || raise === 'RAISE_BOTH_HANDS') { kp[7] = [0.36, 0.13]; lift(9); kp[9]![0] = 0.34; }
  if (raise === 'RAISE_RIGHT_HAND' || raise === 'RAISE_BOTH_HANDS') { kp[8] = [0.64, 0.13]; lift(10); kp[10]![0] = 0.66; }
  const P = (i: number) => kp[i]!;
  return <Svg width="100%" height="100%" viewBox="0 0 1 1" preserveAspectRatio="xMidYMid meet" style={StyleSheet.absoluteFill}>
    <G stroke={COLORS.primary} strokeWidth={0.012} strokeLinecap="round">
      {BONES.map(([a, b]) => <Line key={`${a}-${b}`} x1={P(a)[0]} y1={P(a)[1]} x2={P(b)[0]} y2={P(b)[1]} />)}
    </G>
    {kp.map((k, i) => k && <Circle key={`h${i}`} cx={k[0]} cy={k[1]} r={0.022} fill={COLORS.primary} opacity={0.25} />)}
    {kp.map((k, i) => k && <Circle key={i} cx={k[0]} cy={k[1]} r={0.01} fill={COLORS.primary} />)}
    {/* 얼굴 자리: 점을 찍지 않고 가린다 (R11) */}
    <Circle cx={0.5} cy={0.11 + 0.18 * depth} r={0.05} fill="#111" stroke={OB.dim} strokeWidth={0.004} />
  </Svg>;
}

function Corners() {
  const c = OB.dim;
  return <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={StyleSheet.absoluteFill} pointerEvents="none">
    <G stroke={c} strokeWidth={0.6} fill="none">
      <Line x1={4} y1={4} x2={12} y2={4} /><Line x1={4} y1={4} x2={4} y2={10} />
      <Line x1={96} y1={4} x2={88} y2={4} /><Line x1={96} y1={4} x2={96} y2={10} />
      <Line x1={4} y1={96} x2={12} y2={96} /><Line x1={4} y1={96} x2={4} y2={90} />
      <Line x1={96} y1={96} x2={88} y2={96} /><Line x1={96} y1={96} x2={96} y2={90} />
    </G>
    <Rect x={0} y={0} width={100} height={100} fill="none" />
  </Svg>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#000' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, minHeight: 48 },
  quit: { minHeight: 44, justifyContent: 'center' },
  quitText: { color: OB.muted, fontSize: 15 },
  demoTag: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: OB.surface, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  rec: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.danger },
  demoText: { color: OB.mutedStrong, fontSize: 12 },
  camera: { flex: 1, marginHorizontal: 12, borderRadius: 24, backgroundColor: '#070707', overflow: 'hidden', borderWidth: 1, borderColor: OB.surfaceRaised },
  livePanel: { position: 'absolute', left: 16, right: 16, bottom: 16, backgroundColor: '#000000E6', borderRadius: 18, padding: 18, alignItems: 'center', gap: 4 },
  liveTitle: { color: OB.muted, fontSize: 13 },
  liveAction: { color: COLORS.primary, fontSize: 24, fontWeight: '800' },
  liveLeft: { color: COLORS.text, fontSize: 13 },
  counterPanel: { position: 'absolute', top: 16, left: 16, right: 16, backgroundColor: '#000000E6', borderRadius: 18, paddingVertical: 12, alignItems: 'center' },
  counter: { color: COLORS.text, fontSize: 56, lineHeight: 64, fontWeight: '800' },
  counterGoal: { color: OB.muted, fontSize: 22, fontWeight: '600' },
  feedback: { fontSize: 15, fontWeight: '700' },
  pausedCover: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: '#000000B3', alignItems: 'center', justifyContent: 'center', gap: 4 },
  pausedText: { color: COLORS.text, fontSize: 22, fontWeight: '700' },
  pausedSub: { color: OB.muted },
  bottom: { padding: 20, gap: 12 },
  warn: { color: COLORS.warning, fontSize: 14, lineHeight: 20 },
  tools: { flexDirection: 'row' },
  shaky: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  shakyText: { color: OB.mutedStrong, fontSize: 13, lineHeight: 18, flex: 1 },
});
