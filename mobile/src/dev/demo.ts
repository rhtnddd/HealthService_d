// [개발 전용] 시연 녹화용 자동 입력. dev-demo 딥링크로 스크립트를 켜면 가입·로그인 화면이
// 입력칸에 포커스를 주고 한 글자씩 타이핑한 뒤 다음 버튼을 누른다. 배포 빌드(__DEV__ false)에서는 켜지지 않는다.
import { useEffect, useRef, useState } from 'react';

export type DemoScript = {
  email?: string; password?: string; nickname?: string; inviteCode?: string; gender?: 'MALE' | 'FEMALE';
  loginEmail?: string; loginPassword?: string;
  /** 한 글자 입력 간격(ms). 느린 화면 캡처로 찍을 때 늘리고, 편집에서 빠르게 재생한다 */
  typeMs?: number;
  done: Set<string>;
};

let script: DemoScript | null = null;

export function setDemo(next: Omit<DemoScript, 'done'> | null) {
  script = next && __DEV__ ? { ...next, done: new Set() } : null;
}

export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const log = (name: string, what: string) => console.log(`[demo] ${name} ${what} ${Date.now()}`);
/** 편집에서 구간을 자르기 위한 표시 (예: 타이핑 시작·끝) */
export const mark = (name: string) => log(name, 'mark');

// 한글 조합 순서: '운' → ['ㅇ', '우', '운'] (두벌식 입력처럼 보이게)
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
export function typingSteps(text: string): string[] {
  const out: string[] = [];
  let done = '';
  for (const ch of text) {
    const code = ch.charCodeAt(0) - 0xac00;
    if (code >= 0 && code < 11172) {
      const cho = Math.floor(code / 588); const jung = Math.floor((code % 588) / 28); const jong = code % 28;
      out.push(done + CHO[cho]);
      out.push(done + String.fromCharCode(0xac00 + cho * 588 + jung * 28));
      if (jong) out.push(done + ch);
    } else {
      out.push(done + ch);
    }
    done += ch;
  }
  return out;
}

/** 한 글자씩 입력한다. 기본 130~190ms 간격 (typeMs로 조절) */
export async function typeInto(set: (v: string) => void, text: string) {
  const base = script?.typeMs ?? 160;
  for (const s of typingSteps(text)) {
    set(s);
    await wait(base * (0.8 + Math.random() * 0.4));
  }
}

/** 이 화면의 데모 단계를 한 번만 실행한다. 최신 상태를 쓰도록 run은 매 렌더 갱신된다. */
export function useDemoStep(name: string, run: (s: DemoScript) => Promise<void>, ready = true) {
  const latest = useRef(run);
  latest.current = run;
  useEffect(() => {
    const s = script;
    if (!ready || !s || s.done.has(name)) return;
    s.done.add(name);
    log(name, 'start');
    void (async () => { await wait(700); await latest.current(s); log(name, 'end'); })();
  }, [name, ready]);
}

/** 최신 함수를 가리키는 ref (데모가 setState 뒤에 버튼 함수를 부를 때 쓴다) */
export function useLatest<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

// 버튼 눌림 표시: 데모가 버튼을 누를 때 그 버튼에 눌림 효과를 보여 준다 (시뮬레이터는 터치를 그리지 않음)
type Listener = (title: string) => void;
const listeners = new Set<Listener>();
export async function tapButton(title: string) {
  listeners.forEach((l) => l(title));
  await wait(380);
}
export function useDemoTap(title: string) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!__DEV__) return;
    const l: Listener = (t) => { if (t === title) { setOn(true); setTimeout(() => setOn(false), 360); } };
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, [title]);
  return on;
}
export const isDemoOn = () => script !== null;
