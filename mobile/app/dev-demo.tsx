// [개발 전용] 시연 녹화용 자동 입력을 켜고 시작 화면으로 보낸다.
//   xcrun simctl openurl booted "exp://127.0.0.1:8081/--/dev-demo?email=..&password=..&nickname=..&code=..&next=/onboarding/birth"
//   로그인만: ?loginEmail=..&loginPassword=..&next=/login
import { useEffect } from 'react';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { setDemo } from '../src/dev/demo';
import { useDraft } from '../src/onboarding/draft';
import { Screen } from '../src/onboarding/ui';

export default function DevDemo() {
  const p = useLocalSearchParams<{ email?: string; password?: string; nickname?: string; code?: string; gender?: string; loginEmail?: string; loginPassword?: string; next?: string; typeMs?: string }>();
  const router = useRouter();
  const { reset } = useDraft();
  useEffect(() => {
    if (!__DEV__) { router.replace('/'); return; }
    reset();
    setDemo({
      email: p.email, password: p.password, nickname: p.nickname, inviteCode: p.code,
      gender: p.gender === 'FEMALE' ? 'FEMALE' : 'MALE', loginEmail: p.loginEmail, loginPassword: p.loginPassword,
      typeMs: p.typeMs ? Number(p.typeMs) : undefined,
    });
    router.replace((p.next || '/') as Href);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <Screen>{null}</Screen>;
}
