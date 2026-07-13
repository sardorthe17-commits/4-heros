import { BaseCharacter } from './base.character';
import { PlayerState, RoomState } from '../types';

export class ArcherCharacter extends BaseCharacter {
    // Kamonchi: zarba 10 ta HP oladi, stamina sal sekinroq ketadi (ritsardan tezroq, sehrgardan sekinroq)
    public attackStaminaCost = 12;

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

    // Kamonchi uchun SHIFT = ko'rinmaslik. Bosib turilgancha ko'rinmas,
    // qo'yib yuborilsa yoki stamina tugasa darrov ko'rinadigan bo'lib qoladi.
    applyHeldAbility(player: PlayerState, room: RoomState): void {
        player.isInvisible = true;
    }

    releaseHeldAbility(player: PlayerState, room: RoomState): void {
        player.isInvisible = false;
    }
}