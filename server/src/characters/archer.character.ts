import { BaseCharacter } from './base.character';
import { PlayerState, RoomState } from '../types';

export class ArcherCharacter extends BaseCharacter {
    handleAttack(player: PlayerState, room: RoomState, angle: number): void {
        room.bulletIdCounter++;
        room.bullets.push({
            id: 'bullet_' + room.bulletIdCounter,
            playerId: player.id,
            x: player.x + 12,
            y: player.y,
            vx: Math.cos(angle) * 1000, // Judayam tez uchadi
            vy: Math.sin(angle) * 1000,
            color: player.color,
            lifetime: 80,
            bulletType: 'arrow'
        });
    }

    handleAbility(player: PlayerState, room: RoomState): void {
        player.isInvisible = true;
        player.abilityDuration = 330; // 5 soniya ko'rinmaslik
        player.abilityCooldown = 660; // Cooldown
    }
}