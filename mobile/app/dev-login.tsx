// [개발 전용] 시뮬레이터를 손으로 누를 수 없을 때 딥링크로 로그인해 화면을 확인한다.
// 개발 서버에서 연 앱(__DEV__)에서만 동작하고, 배포 빌드에서는 시작 화면으로 보낸다.
//   xcrun simctl openurl booted "exp://127.0.0.1:8081/--/dev-login?email=...&password=...&next=/home"
import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Text } from 'react-native';
import { api } from '../src/auth/session';
import { Screen } from '../src/onboarding/ui';

export default function DevLogin() {
  const { email, password, next } = useLocalSearchParams<{ email?: string; password?: string; next?: string }>();
  const router = useRouter();
  const [msg, setMsg] = useState('개발용 로그인 중');
  useEffect(() => {
    if (!__DEV__ || !email || !password) { router.replace('/'); return; }
    api.login(email, password)
      .then(() => router.replace((next || '/home') as Href))
      .catch((e: Error) => setMsg(e.message));
  }, [email, password, next, router]);
  return <Screen style={{ alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff' }}>{msg}</Text></Screen>;
}
