import { BaseCharacter } from './base.character';
import { PlayerState, RoomState } from '../types';

export class MageCharacter extends BaseCharacter {
    // Sehrgar: zarba 30 ta HP oladi (eng kuchli), lekin stamina tez ketadi
    public attackStaminaCost = 25;

    handleAttack(player: PlayerState, room: RoomState, angle: number): void {
        room.bulletIdCounter++;
        room.bullets.push({
            id: 'bullet_' + room.bulletIdCounter,
            playerId: player.id,
            x: player.x + 12,
            y: player.y,
            vx: Math.cos(angle) * 600, // Og'irroq va sekinroq o'q
            vy: Math.sin(angle) * 600,
            color: player.color,
            lifetime: 80,
            bulletType: 'fireball'
        });
    }

    // Sehrgar uchun SHIFT = atrofdagi botlarni muzlatish. Bosib turilgancha
    // radiusdagi botlar muzlab turadi (har tikda yangilanadi), qo'yib
    // yuborilsa muzlash tabiiy ravishda tugab boradi.
    applyHeldAbility(player: PlayerState, room: RoomState): void {
        room.bots.forEach(bot => {
            const dist = Math.hypot(bot.x - player.x, bot.y - player.y);
            if (dist < 250) {
                bot.freezeDuration = Math.max(bot.freezeDuration, 10);
            }
        });
    }

    releaseHeldAbility(player: PlayerState, room: RoomState): void {
        // Bo'sh - muzlash effekti o'zi asta-sekin tugaydi (freezeDuration kamayadi)
    }
}