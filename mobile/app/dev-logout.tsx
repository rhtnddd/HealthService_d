// [개발 전용] 딥링크로 로그아웃하고 시작 화면으로 간다 (시뮬레이터 녹화용). 배포 빌드에서는 아무것도 하지 않는다.
//   xcrun simctl openurl booted "exp://127.0.0.1:8081/--/dev-logout"
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { logout } from '../src/auth/session';
import { Screen } from '../src/onboarding/ui';

export default function DevLogout() {
  const router = useRouter();
  useEffect(() => {
    if (!__DEV__) { router.replace('/'); return; }
    void logout().finally(() => router.replace('/'));
  }, [router]);
  return <Screen>{null}</Screen>;
}
