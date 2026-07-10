import { BaseCharacter } from './base.character';
import { PlayerState, RoomState } from '../types';

export class KnightCharacter extends BaseCharacter {
    handleAttack(player: PlayerState, room: RoomState, angle: number): void {
        room.bulletIdCounter++;
        room.bullets.push({
            id: 'bullet_' + room.bulletIdCounter,
            playerId: player.id,
            x: player.x + (Math.cos(angle) * 15),
            y: player.y + 10,
            vx: Math.cos(angle) * 150, // Sekin va yaqin masofaga
            vy: Math.sin(angle) * 150,
            color: player.color,
            lifetime: 6, // Havoda juda qisqa vaqt turadi (qilich zarbasi)
            bulletType: 'melee'
        });
    }

    handleAbility(player: PlayerState, room: RoomState): void {
        // Ritsar uchun SHIFT endi alohida "ushlab turish" mexanizmi orqali ishlaydi
        // (qarang: room.manager.ts -> startShield / stopShield). Bu funksiya ishlatilmaydi.
    }
}