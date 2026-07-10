import { PlayerState, RoomState } from '../types';

export abstract class BaseCharacter {
    // Stamina bilan bog'liq sozlamalar (bir joyda, hammasi shu yerdan boshqariladi)
    public static readonly ATTACK_STAMINA_COST = 15;
    public static readonly ABILITY_STAMINA_COST = 60; // Oshirildi - endi shift ta'siri sezilarli bo'ladi
    public static readonly ATTACK_COOLDOWN_TICKS = 12; // ~0.36s (30ms/tick) - Enter spam qilib bo'lmaydi
    public static readonly STAMINA_REGEN_PER_TICK = 0.6; // ~18 stamina/soniya tiklanadi
    public static readonly SHIELD_DRAIN_PER_TICK = 1.2; // Qalqonni ushlab turish ~36 stamina/soniya sarflaydi

    // Har bir kadrda taymerlarni yangilash (cooldown va duration kamaytirish)
    public static updateTimers(player: PlayerState): void {
        if (player.abilityCooldown > 0) player.abilityCooldown--;
        if (player.attackCooldown > 0) player.attackCooldown--;

        // RITSAR QALQONI: ushlab turilsa stamina ketadi, aks holda oddiy tiklanadi
        if (player.characterType === 'knight' && player.isHoldingShield) {
            player.stamina = Math.max(0, player.stamina - this.SHIELD_DRAIN_PER_TICK);
            if (player.stamina <= 0) {
                player.isHoldingShield = false; // Stamina tugasa qalqon avtomatik yopiladi
            }
        } else if (player.stamina < 100) {
            player.stamina = Math.min(100, player.stamina + this.STAMINA_REGEN_PER_TICK);
        }

        if (player.abilityDuration > 0) {
            player.abilityDuration--;
            if (player.abilityDuration === 0) {
                // Qobiliyat tugaganda standart holatga qaytarish
                this.onAbilityExpire(player);
            }
        }
    }

    // Qobiliyat tugaganda nima sodir bo'lishi (ayrim personajlar buni qayta yozadi)
    protected static onAbilityExpire(player: PlayerState): void {
        player.isInvisible = false;
        player.speedMultiplier = 1;
    }

    // Har bir personaj o'zicha hujum qiladi (Abstract funksiyalar)
    abstract handleAttack(player: PlayerState, room: RoomState, angle: number): void;

    // Har bir personaj o'zicha maxsus qobiliyat ishlatadi
    abstract handleAbility(player: PlayerState, room: RoomState): void;
}