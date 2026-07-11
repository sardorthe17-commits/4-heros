import { BaseCharacter } from './base.character';
import { PlayerState, RoomState } from '../types';

export class SamuraiCharacter extends BaseCharacter {
    // Samuray: zarba 20 ta HP oladi, ritsar kabi stamina sekin ketadi
    public attackStaminaCost = 8;

    handleAttack(player: PlayerState, room: RoomState, angle: number): void {
        room.bulletIdCounter++;
        room.bullets.push({
            id: 'bullet_' + room.bulletIdCounter,
            playerId: player.id,
            x: player.x + (Math.cos(angle) * 20),
            y: player.y + 10,
            vx: Math.cos(angle) * 220, // Katananing kesish tezligi
            vy: Math.sin(angle) * 220,
            color: player.color,
            lifetime: 8, // Juda qisqa emas endi - zarba izchil tegishi uchun
            bulletType: 'melee'
        });
    }

    // Samuray uchun SHIFT = tezlik boost. Bosib turilgancha tez yuradi,
    // qo'yib yuborilsa yoki stamina tugasa oddiy tezlikka qaytadi.
    applyHeldAbility(player: PlayerState, room: RoomState): void {
        player.speedMultiplier = 1.8;
    }

    releaseHeldAbility(player: PlayerState, room: RoomState): void {
        player.speedMultiplier = 1;
    }
}