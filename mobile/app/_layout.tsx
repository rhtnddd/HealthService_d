import '../global.css';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { DraftProvider } from '../src/onboarding/draft';
import { COLORS } from '../src/theme/tokens';
export default function Layout() {
  return <DraftProvider><StatusBar style="light" /><Stack screenOptions={{ headerStyle: { backgroundColor: COLORS.background }, headerTintColor: COLORS.text, contentStyle: { backgroundColor: COLORS.background } }}>
    {/* 가입·로그인 화면은 시안대로 상단 바 없이 */}
    <Stack.Screen name="index" options={{ headerShown: false }} />
    <Stack.Screen name="login" options={{ headerShown: false }} />
    <Stack.Screen name="onboarding" options={{ headerShown: false }} />
    {/* 아래 탭 4개는 화면 전환 애니메이션 없이 바꾼다 */}
    <Stack.Screen name="home" options={{ headerShown: false, animation: 'none' }} />
    <Stack.Screen name="character" options={{ headerShown: false, animation: 'none' }} />
    <Stack.Screen name="guild" options={{ headerShown: false, animation: 'none' }} />
    <Stack.Screen name="reviews" options={{ headerShown: false, animation: 'none' }} />
    <Stack.Screen name="session/prepare" options={{ headerShown: false }} />
    <Stack.Screen name="session/run" options={{ headerShown: false, gestureEnabled: false }} />
    <Stack.Screen name="submission/[id]" options={{ headerShown: false }} />
    <Stack.Screen name="submission/review" options={{ headerShown: false }} />
    <Stack.Screen name="review/[id]" options={{ headerShown: false }} />
    <Stack.Screen name="result/[id]" options={{ headerShown: false, gestureEnabled: false }} />
    <Stack.Screen name="dev-login" options={{ headerShown: false, animation: 'none' }} />
    <Stack.Screen name="dev-logout" options={{ headerShown: false, animation: 'none' }} />
    <Stack.Screen name="workout/[id]" options={{ title: '보상 미리보기' }} />
  </Stack></DraftProvider>;
}
