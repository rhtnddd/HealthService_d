// 확인 자료의 관절 선 (얼굴 없음). 서버의 관절 선 리플레이(skeletonReplayUrl)가 아직 null이라
// 스쿼트 동작을 몇 장의 정지 화면으로 보여 준다 [임시: API.md '노션 명세와 구현이 다른 곳' API-034·037].
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Line } from 'react-native-svg';
import { COLORS } from '../theme/tokens';
import { OB } from '../onboarding/ui';
import { poseAt } from './workout';

const BONES: [number, number][] = [[5, 6], [5, 7], [7, 9], [6, 8], [8, 10], [5, 11], [6, 12], [11, 12], [11, 13], [13, 15], [12, 14], [14, 16]];

export function SkeletonStrip({ count = 6, highlight = [] as number[] }: { count?: number; highlight?: number[] }) {
  return <View style={styles.strip} accessibilityLabel="관절 선으로 본 스쿼트 동작">
    {Array.from({ length: count }, (_, i) => {
      const depth = [0, 0.5, 1, 0.5, 0, 0.8][i % 6];
      const kp = poseAt(depth);
      const color = highlight.includes(i + 1) ? COLORS.warning : COLORS.primary;
      return <View key={i} style={styles.frame}>
        <Svg width="100%" height="100%" viewBox="0.2 0 0.6 1">
          <G stroke={color} strokeWidth={0.018} strokeLinecap="round">
            {BONES.map(([a, b]) => <Line key={`${a}-${b}`} x1={kp[a]![0]} y1={kp[a]![1]} x2={kp[b]![0]} y2={kp[b]![1]} />)}
          </G>
          {kp.map((k, j) => k && <Circle key={j} cx={k[0]} cy={k[1]} r={0.014} fill={color} />)}
        </Svg>
      </View>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', gap: 6 },
  frame: { flex: 1, aspectRatio: 0.6, backgroundColor: '#0A0A0A', borderRadius: 10, borderWidth: 1, borderColor: OB.surfaceRaised },
});
