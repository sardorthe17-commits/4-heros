export interface PlayerState {
    id: string;
    x: number;
    y: number;
    characterType: string;
    color: number;
    hp: number;
    isInvisible: boolean;
    speedMultiplier: number;
    abilityCooldown: number;
    abilityDuration: number;
    stamina: number;          // 0-100: hujum va qobiliyat uchun sarflanadigan energiya
    attackCooldown: number;   // Hujumlar orasidagi eng qisqa vaqt (spam qilishning oldini oladi)
    isHoldingShield: boolean; // Faqat Ritsar uchun: SHIFT bosib turilganda true
}

export interface BotState {
    id: string;
    x: number;
    y: number;
    color: number;
    hp: number;
    freezeDuration: number;
}

export interface BulletState {
    id: string;
    playerId: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    color: number;
    lifetime: number;
    bulletType: 'normal' | 'arrow' | 'fireball' | 'melee';
}

export interface RoomState {
    id: string;
    name: string;
    hostId: string;
    players: { [key: string]: PlayerState };
    bots: BotState[];
    bullets: BulletState[];
    bulletIdCounter: number;
    isStarted: boolean;
}