import { BaseCharacter } from './base.character';
import { PlayerState, RoomState } from '../types';

export class SamuraiCharacter extends BaseCharacter {
    handleAttack(player: PlayerState, room: RoomState, angle: number): void {
        room.bulletIdCounter++;
        room.bullets.push({
            id: 'bullet_' + room.bulletIdCounter,
            playerId: player.id,
            x: player.x + (Math.cos(angle) * 20),
            y: player.y,
            vx: Math.cos(angle) * 220, // Katananing kesish tezligi
            vy: Math.sin(angle) * 220,
            color: player.color,
            lifetime: 5, // Juda qisqa masofa
            bulletType: 'melee'
        });
    }

    handleAbility(player: PlayerState, room: RoomState): void {
        player.speedMultiplier = 1.8; // Tezlik boost
        player.abilityDuration = 330; // 5 soniya davom etadi
        player.abilityCooldown = 660;
    }
}