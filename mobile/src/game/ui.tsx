// 가입 이후 화면 공통 요소. 가입 시안(검정 배경·라임 강조·알약 버튼)과 같은 토큰을 쓴다.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname, useRouter, useFocusEffect } from 'expo-router';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { HttpError } from '../api/http';
import type { SubmissionStatus } from '../api/game';
import { COLORS } from '../theme/tokens';
import { OB } from '../onboarding/ui';
import { STATUS_TEXT } from './status';

export { OB };

const TONE = { accent: COLORS.primary, warning: COLORS.warning, muted: OB.muted, danger: COLORS.danger };

/** 화면에 다시 들어올 때마다 불러오는 데이터. 로딩·오류·빈 결과를 구분한다 (DESIGN.md 5절). */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  const run = useCallback(async (mode: 'first' | 'refresh' | 'silent' = 'first') => {
    if (mode === 'refresh') setRefreshing(true);
    try {
      const value = await load();
      if (alive.current) { setData(value); setError(null); }
    } catch (e) {
      if (alive.current) setError(errorMessage(e));
    } finally {
      if (alive.current) { setLoading(false); setRefreshing(false); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useFocusEffect(useCallback(() => { void run(data ? 'silent' : 'first'); }, [run]));
  return { data, error, loading, refreshing, reload: () => run('refresh'), silent: () => run('silent'), setData };
}

export function errorMessage(e: unknown): string {
  if (e instanceof HttpError) {
    if (e.status === 403) return '이 기록을 볼 수 없어요.';
    if (e.status === 404) return '기록을 찾을 수 없어요.';
    if (e.status === 412) return '다른 요청이 먼저 처리됐어요. 최신 상태를 다시 불러올게요.';
    return e.message;
  }
  return e instanceof Error ? e.message : '요청을 처리하지 못했어요.';
}

export function Page({ children, onRefresh, refreshing = false, tab, padBottom = 0 }: {
  children: ReactNode; onRefresh?: () => void; refreshing?: boolean; tab?: boolean; padBottom?: number;
}) {
  return <SafeAreaView style={styles.page} edges={['top']}>
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: (tab ? 110 : 40) + padBottom }]}
      refreshControl={onRefresh ? <RefreshControl tintColor={COLORS.primary} refreshing={refreshing} onRefresh={onRefresh} /> : undefined}>
      {children}
    </ScrollView>
    {tab && <TabBar />}
  </SafeAreaView>;
}

export function TopBar({ title, right }: { title?: string; right?: ReactNode }) {
  const router = useRouter();
  return <View style={styles.topBar}>
    <Pressable accessibilityRole="button" accessibilityLabel="뒤로" onPress={() => router.canGoBack() ? router.back() : router.replace('/home')} style={styles.back} hitSlop={8}>
      <Svg width={22} height={22} viewBox="0 0 24 24"><Path d="M15 5l-7 7 7 7" stroke={COLORS.text} strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" /></Svg>
    </Pressable>
    {title ? <Text style={styles.topTitle} numberOfLines={1}>{title}</Text> : <View style={{ flex: 1 }} />}
    <View style={{ minWidth: 44, alignItems: 'flex-end' }}>{right}</View>
  </View>;
}

export function H1({ children, accent }: { children: ReactNode; accent?: ReactNode }) {
  return <Text accessibilityRole="header" style={styles.h1}>{children}{accent ? <Text style={{ color: COLORS.primary }}>{accent}</Text> : null}</Text>;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <Text style={styles.eyebrow}>{children}</Text>;
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return <View style={styles.sectionRow}><Text accessibilityRole="header" style={styles.section}>{children}</Text>{right}</View>;
}

export function Card({ children, style, onPress, highlight, label }: { children: ReactNode; style?: ViewStyle; onPress?: () => void; highlight?: boolean; label?: string }) {
  const s = [styles.card, highlight && styles.cardHi, style].filter(Boolean) as ViewStyle[];
  if (!onPress) return <View style={s}>{children}</View>;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={s}>{children}</Pressable>;
}

export function StatusChip({ status }: { status: SubmissionStatus }) {
  const t = STATUS_TEXT[status];
  const c = TONE[t.tone];
  return <View style={[styles.chip, { borderColor: c }]}><View style={[styles.chipDot, { backgroundColor: c }]} /><Text style={[styles.chipText, { color: c }]}>{t.label}</Text></View>;
}

export function Pill({ label, selected, onPress, disabled }: { label: string; selected?: boolean; onPress?: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="radio" accessibilityState={{ selected: !!selected, disabled: !!disabled }} disabled={disabled} onPress={onPress}
    style={[styles.pill, selected ? styles.pillOn : null, disabled ? { opacity: 0.4 } : null].filter(Boolean) as ViewStyle[]}>
    <Text style={[styles.pillText, selected && { color: '#000' }]}>{label}</Text>
  </Pressable>;
}

export function Bar({ value, max, color = COLORS.primary, height = 10, label }: { value: number; max: number; color?: string; height?: number; label?: string }) {
  const ratio = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max, now: value }}
    style={[styles.bar, { height, borderRadius: height }]}>
    <View style={{ width: `${ratio * 100}%`, height, borderRadius: height, backgroundColor: color }} />
  </View>;
}

export function Stat({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return <View style={styles.stat}><Text style={[styles.statValue, accent && { color: COLORS.primary }]}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

export function Loading({ text = '불러오는 중' }: { text?: string }) {
  return <View style={styles.center}><ActivityIndicator color={COLORS.primary} /><Text style={styles.muted}>{text}</Text></View>;
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <Card style={{ gap: 10 }}>
    <Text accessibilityLiveRegion="polite" style={{ color: COLORS.danger, fontSize: 15, lineHeight: 22 }}>{message}</Text>
    {onRetry && <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retry}><Text style={styles.retryText}>다시 불러오기</Text></Pressable>}
  </Card>;
}

export function Empty({ title, body }: { title: string; body?: string }) {
  return <Card style={{ alignItems: 'center', paddingVertical: 28, gap: 6 }}><Text style={styles.emptyTitle}>{title}</Text>{body ? <Text style={[styles.muted, { textAlign: 'center' }]}>{body}</Text> : null}</Card>;
}

export const Muted = ({ children, center }: { children: ReactNode; center?: boolean }) => <Text style={[styles.muted, center && { textAlign: 'center' }]}>{children}</Text>;

// 아래 탭 (홈·캐릭터·길드·확인 요청). 탭 라이브러리를 더하지 않고 화면 이동으로 만든다.
const TABS = [
  { path: '/home', label: '홈', d: 'M4 11l8-7 8 7v9h-5v-6H9v6H4z' },
  { path: '/character', label: '캐릭터', d: 'M12 12a4 4 0 100-8 4 4 0 000 8zm-7 9c0-4 3-6 7-6s7 2 7 6' },
  { path: '/guild', label: '길드', d: 'M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z' },
  { path: '/reviews', label: '확인 요청', d: 'M4 5h16v11H8l-4 4zM8 9h8M8 12h5' },
] as const;

export function TabBar() {
  const path = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return <View accessibilityRole="tablist" style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
    {TABS.map((t) => {
      const on = path === t.path;
      return <Pressable key={t.path} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={t.label}
        onPress={() => { if (!on) router.replace(t.path); }} style={styles.tab}>
        <Svg width={24} height={24} viewBox="0 0 24 24"><Path d={t.d} stroke={on ? COLORS.primary : OB.dim} strokeWidth={1.8} fill="none" strokeLinejoin="round" strokeLinecap="round" /></Svg>
        <Text style={[styles.tabText, on && { color: COLORS.primary }]}>{t.label}</Text>
      </Pressable>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingHorizontal: 20, paddingTop: 8, gap: 16 },
  topBar: { flexDirection: 'row', alignItems: 'center', minHeight: 48, gap: 8 },
  back: { width: 44, height: 44, alignItems: 'flex-start', justifyContent: 'center' },
  topTitle: { flex: 1, color: COLORS.text, fontSize: 17, fontWeight: '600', textAlign: 'center' },
  h1: { color: COLORS.text, fontSize: 28, lineHeight: 37, fontWeight: '700' },
  eyebrow: { color: COLORS.primary, fontSize: 13, fontWeight: '600', letterSpacing: 0.5 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  section: { color: COLORS.text, fontSize: 18, fontWeight: '700' },
  card: { backgroundColor: OB.surface, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: OB.surface },
  cardHi: { borderColor: COLORS.primary },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { fontSize: 12, fontWeight: '700' },
  pill: { minHeight: 44, paddingHorizontal: 18, borderRadius: 999, borderWidth: 1, borderColor: OB.line, backgroundColor: OB.surface, alignItems: 'center', justifyContent: 'center' },
  pillOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  pillText: { color: COLORS.text, fontSize: 15, fontWeight: '600' },
  bar: { backgroundColor: OB.surfaceRaised, overflow: 'hidden', width: '100%' },
  stat: { flex: 1, gap: 2 },
  statValue: { color: COLORS.text, fontSize: 22, fontWeight: '700' },
  statLabel: { color: OB.muted, fontSize: 12 },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 10 },
  muted: { color: OB.muted, fontSize: 14, lineHeight: 20 },
  retry: { alignSelf: 'flex-start', paddingHorizontal: 16, minHeight: 40, borderRadius: 999, backgroundColor: OB.surfaceRaised, justifyContent: 'center' },
  retryText: { color: COLORS.text, fontWeight: '600' },
  emptyTitle: { color: COLORS.text, fontSize: 16, fontWeight: '600' },
  tabBar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', backgroundColor: '#0B0B0B', borderTopWidth: 1, borderTopColor: OB.surfaceRaised, paddingTop: 8 },
  tab: { flex: 1, alignItems: 'center', gap: 3, minHeight: 48, justifyContent: 'center' },
  tabText: { color: OB.dim, fontSize: 11, fontWeight: '600' },
});
