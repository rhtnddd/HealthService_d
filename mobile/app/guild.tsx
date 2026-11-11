// 길드: 길드 정보·주간 보스·길드원·초대 코드·탈퇴, 길드가 없으면 가입·생성 (JN-011·023, API-009~016·046)
import { useState } from 'react';
import { Alert, Image, StyleSheet, Text, View } from 'react-native';
import { api, game } from '../src/auth/session';
import { MONSTERS } from '../src/game/assets';
import { Bar, Card, ErrorBox, Eyebrow, H1, Loading, Muted, OB, Page, SectionTitle, errorMessage, useLoad } from '../src/game/ui';
import { isInviteCode } from '../src/onboarding/rules';
import { ErrorText, Field, PillButton } from '../src/onboarding/ui';
import { COLORS } from '../src/theme/tokens';

export default function GuildPage() {
  const { data, error, loading, refreshing, reload, silent } = useLoad(async () => {
    const me = await api.me();
    if (!me.guildId) return { me, guild: null, members: [], boss: null, recommended: await api.recommendedGuilds().catch(() => []) };
    const [guild, members, boss] = await Promise.all([game.guild(me.guildId), game.guildMembers(me.guildId), game.boss(me.guildId).catch(() => null)]);
    return { me, guild, members, boss, recommended: [] };
  });
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [invite, setInvite] = useState<{ inviteCode: string; expiresAt: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key); setActionError(null);
    try { await fn(); await silent(); } catch (e) { setActionError(errorMessage(e)); } finally { setBusy(null); }
  };

  if (loading) return <Page tab><Loading /></Page>;
  if (!data) return <Page tab><ErrorBox message={error ?? '불러오지 못했어요.'} onRetry={reload} /></Page>;
  const { me, guild, members, boss, recommended } = data;

  if (!guild) return <Page tab onRefresh={reload} refreshing={refreshing}>
    <View style={{ gap: 6, marginTop: 8 }}><Eyebrow>길드</Eyebrow><H1 accent="함께 싸워요">길드원과{'\n'}</H1>
      <Muted>길드원은 서로의 애매한 기록을 확인해 줄 수 있어요. 주간 보스도 함께 공격해요.</Muted></View>
    <Card style={{ gap: 12 }}>
      <Field label="초대 코드" variant="box" value={code} onChangeText={(t) => setCode(t.toUpperCase())} autoCapitalize="characters" maxLength={6} placeholder="6자리 코드" />
      <PillButton title="코드로 가입" disabled={!isInviteCode(code)} loading={busy === 'code'} onPress={() => run('code', () => api.joinGuildByCode(code))} />
    </Card>
    {recommended.length > 0 && <><SectionTitle>추천 길드</SectionTitle>
      {recommended.map((g) => <Card key={g.guildId} style={styles.rec}>
        <View style={{ flex: 1 }}><Text style={styles.recName}>{g.name}</Text><Muted>길드원 {g.memberCount}명</Muted></View>
        <View style={{ width: 110 }}><PillButton title="가입" variant="secondary" loading={busy === g.guildId} onPress={() => run(g.guildId, () => api.joinGuild(g.guildId))} /></View>
      </Card>)}</>}
    <SectionTitle>새 길드 만들기</SectionTitle>
    <Card style={{ gap: 12 }}>
      <Field label="길드 이름" variant="box" value={name} onChangeText={setName} maxLength={20} placeholder="2~20자" />
      <PillButton title="만들기" variant="secondary" disabled={name.trim().length < 2} loading={busy === 'create'} onPress={() => run('create', () => game.createGuild(name.trim()))} />
    </Card>
    <ErrorText>{actionError}</ErrorText>
  </Page>;

  const leader = me.isGuildLeader;
  return <Page tab onRefresh={reload} refreshing={refreshing}>
    <View style={{ gap: 6, marginTop: 8 }}>
      <Eyebrow>{leader ? '내가 길드장' : '길드원'}</Eyebrow>
      <H1>{guild.name}</H1>
      <Muted>길드장 {guild.leader.nickname} · 길드원 {guild.memberCount}명</Muted>
    </View>

    {boss && <Card style={styles.boss}>
      <Image source={MONSTERS.reaper} style={styles.bossImg} resizeMode="contain" accessibilityLabel="주간 보스" />
      <View style={{ width: '58%', gap: 8 }}>
        <Text style={styles.bossTag}>이번 주 보스</Text>
        <Text style={styles.bossName}>{boss.status === 'DEFEATED' ? '처치 완료!' : '심판의 사신'}</Text>
        <Text style={styles.hp}>HP {boss.hp.toLocaleString()} / {boss.hpMax.toLocaleString()}</Text>
        <Bar value={boss.hp} max={boss.hpMax} color={COLORS.danger} label="보스 체력" />
        <Muted>길드 누적 피해 {boss.guildTotalDamage.toLocaleString()}</Muted>
      </View>
    </Card>}

    {leader && <Card style={{ gap: 10 }}>
      <Text style={styles.k}>초대 코드</Text>
      {invite ? <Text selectable style={styles.code}>{invite.inviteCode}</Text> : <Muted>코드를 만들어 길드원을 초대하세요. 72시간 동안 쓸 수 있어요.</Muted>}
      <PillButton title={invite ? '새 코드 만들기' : '초대 코드 만들기'} variant="secondary" loading={busy === 'invite'}
        onPress={() => run('invite', async () => setInvite(await game.invite(guild.id)))} />
    </Card>}

    <SectionTitle>길드원</SectionTitle>
    <Card style={{ gap: 2, paddingVertical: 6 }}>
      {members.map((m, i) => <View key={m.userId} style={[styles.member, i > 0 && styles.memberLine]}>
        <View style={styles.dot}><Text style={styles.dotText}>{m.nickname.slice(0, 1)}</Text></View>
        <Text style={styles.memberName}>{m.nickname}{m.userId === me.id ? ' (나)' : ''}</Text>
        {m.role === 'LEADER' && <Text style={styles.leader}>길드장</Text>}
      </View>)}
    </Card>

    <ErrorText>{actionError}</ErrorText>
    {!leader && <PillButton title="길드 탈퇴" variant="text" onPress={() => Alert.alert('길드를 탈퇴할까요?', '탈퇴하면 길드원에게 확인을 요청할 수 없어요.', [
      { text: '아니요', style: 'cancel' },
      { text: '탈퇴', style: 'destructive', onPress: () => run('leave', () => game.leaveGuild(guild.id)) },
    ])} />}
  </Page>;
}

const styles = StyleSheet.create({
  rec: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  recName: { color: COLORS.text, fontSize: 16, fontWeight: '700' },
  boss: { padding: 20, overflow: 'hidden', minHeight: 200, justifyContent: 'center', borderColor: '#3A1515' },
  bossImg: { position: 'absolute', right: -14, top: 0, width: 170, height: 200 },
  bossTag: { color: COLORS.danger, fontSize: 13, fontWeight: '700' },
  bossName: { color: COLORS.text, fontSize: 24, fontWeight: '800' },
  hp: { color: COLORS.danger, fontSize: 13, fontWeight: '600' },
  k: { color: OB.muted, fontSize: 13 },
  code: { color: COLORS.primary, fontSize: 34, fontWeight: '900', letterSpacing: 6 },
  member: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
  memberLine: { borderTopWidth: 1, borderTopColor: OB.surfaceRaised },
  dot: { width: 34, height: 34, borderRadius: 17, backgroundColor: OB.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  dotText: { color: COLORS.primary, fontWeight: '700' },
  memberName: { color: COLORS.text, fontSize: 15, flex: 1 },
  leader: { color: '#000', backgroundColor: COLORS.primary, fontSize: 11, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' },
});
