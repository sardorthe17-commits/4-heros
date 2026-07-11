import { BaseCharacter } from './base.character';
import { PlayerState, RoomState } from '../types';

export class KnightCharacter extends BaseCharacter {
    // Ritsar: zarba 20 ta HP oladi, lekin stamina sekin ketadi
    public attackStaminaCost = 8;

    handleAttack(player: PlayerState, room: RoomState, angle: number): void {
        room.bulletIdCounter++;
        room.bullets.push({
            id: 'bullet_' + room.bulletIdCounter,
            playerId: player.id,
            x: player.x + (Math.cos(angle) * 15),
            y: player.y,
            vx: Math.cos(angle) * 150, // Sekin va yaqin masofaga
            vy: Math.sin(angle) * 150,
            color: player.color,
            lifetime: 9, // Havoda biroz uzoqroq turadi - zarba izchil tegishi uchun
            bulletType: 'melee'
        });
    }

    // Ritsar uchun SHIFT = qalqon. Qalqonning o'zi (zarardan himoya) va vizual
    // ko'rsatilishi to'g'ridan-to'g'ri player.isHoldingAbility maydoniga qarab
    // game.engine.ts ichida tekshiriladi, shuning uchun bu yerda qo'shimcha effekt kerak emas.
    applyHeldAbility(player: PlayerState, room: RoomState): void {
        // Bo'sh - qalqon holati faqat isHoldingAbility bayrog'i orqali boshqariladi
    }

    releaseHeldAbility(player: PlayerState, room: RoomState): void {
        // Bo'sh - qo'shimcha holatni bekor qilish shart emas
    }
}