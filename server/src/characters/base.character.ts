import { PlayerState, RoomState } from '../types';

export abstract class BaseCharacter {
    // Stamina bilan bog'liq umumiy sozlamalar (bir joyda, hammasi shu yerdan boshqariladi)
    public static readonly ATTACK_STAMINA_COST = 15;         // Standart (agar personaj o'zinikini belgilamasa)
    public static readonly ATTACK_COOLDOWN_TICKS = 12;      // ~0.36s (30ms/tick) - Enter spam qilib bo'lmaydi
    public static readonly ABILITY_DRAIN_PER_TICK = 1.2;    // SHIFT ushlab turilsa ~36 stamina/soniya sarflanadi
    public static readonly STAMINA_REGEN_PER_TICK = 0.35;   // ~10.5 stamina/soniya tiklanadi (qiyinroq bo'lishi uchun sekinlashtirildi)
    public static readonly REGEN_DELAY_TICKS = 45;          // ~1.35s: tugagach shuncha vaqt tiklanish boshlanmaydi

    // Har bir personaj o'z hujumi uchun stamina narxini shu yerda belgilaydi
    // (Ritsar/Samuray: sekin ketadi, Kamonchi: sal sekin, Sehrgar: tez ketadi)
    public attackStaminaCost: number = BaseCharacter.ATTACK_STAMINA_COST;

    // Har bir kadrda taymerlarni yangilash: cooldown, stamina drenaji va tiklanish kechikishi
    public static updateTimers(player: PlayerState): void {
        if (player.attackCooldown > 0) player.attackCooldown--;

        let isDraining = false;

        // SHIFT (qobiliyat) ushlab turilsa - BARCHA personajlar uchun stamina ketadi
        if (player.isHoldingAbility) {
            player.stamina = Math.max(0, player.stamina - this.ABILITY_DRAIN_PER_TICK);
            isDraining = true;
            if (player.stamina <= 0) {
                player.isHoldingAbility = false; // Stamina tugasa majburiy o'chadi
            }
        }

        // ENTER (hujum) ushlab turilsa ham, tiklanish kechiktiriladi
        // (har bir zarbaning o'zi stamina yeydi, buni RoomManager.handlePlayerAttack ichida ko'ramiz)
        if (player.isHoldingAttack) {
            isDraining = true;
        }

        if (isDraining) {
            // Faol ishlatilayotgan vaqtda kechikish hisoblagichi har doim to'lib turadi
            player.staminaRegenDelay = this.REGEN_DELAY_TICKS;
        } else if (player.staminaRegenDelay > 0) {
            // Qo'yib yuborilgandan keyin ozgina kutish kerak, tiklanish darrov boshlanmaydi
            player.staminaRegenDelay--;
        } else if (player.stamina < 100) {
            player.stamina = Math.min(100, player.stamina + this.STAMINA_REGEN_PER_TICK);
        }
    }

    // Har bir personaj o'zicha hujum qiladi (Abstract funksiyalar)
    abstract handleAttack(player: PlayerState, room: RoomState, angle: number): void;

    // SHIFT ushlab turilgancha, har tikda chaqiriladi (masalan: ko'rinmaslik, tezlik, muzlatish)
    abstract applyHeldAbility(player: PlayerState, room: RoomState): void;

    // SHIFT qo'yib yuborilganda yoki stamina tugaganda, effektni bekor qilish uchun chaqiriladi
    abstract releaseHeldAbility(player: PlayerState, room: RoomState): void;
}