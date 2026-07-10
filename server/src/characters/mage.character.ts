import { BaseCharacter } from './base.character';
import { PlayerState, RoomState } from '../types';

export class MageCharacter extends BaseCharacter {
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

    handleAbility(player: PlayerState, room: RoomState): void {
        // 250px radiusdagi barcha botlarni muzlatish
        room.bots.forEach(bot => {
            const dist = Math.hypot(bot.x - player.x, bot.y - player.y);
            if (dist < 250) {
                bot.freezeDuration = 260; // ~4 soniya qotib turadi
            }
        });
        player.abilityCooldown = 500; // Mage cooldown
    }
}