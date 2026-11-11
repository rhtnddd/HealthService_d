// 게임 이미지 (Figma '전운시 표백제' Section 1·2의 몬스터·아바타 공격·근육 실루엣, 배경을 지워 assets/game에 둠).
import { DEMO_DUNGEON_ID } from '../api/game';

export const MONSTERS = {
  wraith: require('../../assets/game/monster1.png'),
  beak: require('../../assets/game/monster2.png'),
  eye: require('../../assets/game/monster3.png'),
  golem: require('../../assets/game/monster4.png'),
  reaper: require('../../assets/game/monster5.png'),
} as const;

export const MUSCLE_SQUAT = require('../../assets/game/muscle-squat.png');

const ATTACK = {
  AVATAR_PANTS: require('../../assets/game/attack-pants.png'),
  AVATAR_SKIRT: require('../../assets/game/attack-skirt.png'),
};
const STANDING = {
  AVATAR_PANTS: require('../../assets/onboarding/avatar-pants.png'),
  AVATAR_SKIRT: require('../../assets/onboarding/avatar-skirt.png'),
};

export const attackOf = (avatarId: string | null | undefined) => ATTACK[avatarId as keyof typeof ATTACK] ?? ATTACK.AVATAR_PANTS;
export const avatarImageOf = (avatarId: string | null | undefined) => STANDING[avatarId as keyof typeof STANDING] ?? STANDING.AVATAR_PANTS;

/** 공략 대상의 그림. 던전 적 이름은 서버 값을 쓰고 그림만 고른다 [제안]. */
export function monsterOf(target: { type: 'DUNGEON' | 'BOSS'; id?: string } | null) {
  if (target?.type === 'BOSS') return MONSTERS.reaper;
  if (target?.id === DEMO_DUNGEON_ID) return MONSTERS.beak;
  return MONSTERS.wraith;
}
