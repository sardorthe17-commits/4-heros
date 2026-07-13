import { Server, Socket } from 'socket.io';
import { RoomState, PlayerState } from '../types';
import { getCharacterLogic } from '../characters';
import { BaseCharacter } from '../characters/base.character';

// Har bir personaj turi uchun aniq belgilangan rang
// (endi tasodifiy rang emas, har doim shu ranglar ishlatiladi)
const CHARACTER_COLORS: { [key: string]: number } = {
    knight: 0x9e9e9e,   // Kulrang
    archer: 0xad1457,   // To'q (yopiq) pushti
    mage: 0x1a237e,     // To'q (yopiq) ko'k
    samurai: 0xd32f2f   // Qizil
};

export class RoomManager {
    private io: Server;
    private activeRooms: { [key: string]: RoomState };

    constructor(io: Server, activeRooms: { [key: string]: RoomState }) {
        this.io = io;
        this.activeRooms = activeRooms;
    }

    // Yangi o'yinchini xonaga (lobbiga) qo'shish
    public joinPlayer(socket: Socket, roomId: string): void {
        const room = this.activeRooms[roomId];
        if (!room) return;

        // O'yinchi birinchi kirganda standart Knight (Ritsar) bo'lib kiradi
        room.players[socket.id] = {
            id: socket.id,
            x: 100 + Math.random() * 200,
            y: 500,
            characterType: 'knight',
            color: CHARACTER_COLORS['knight'],
            hp: 100,
            isInvisible: false,
            speedMultiplier: 1,
            stamina: 100,
            attackCooldown: 0,
            staminaRegenDelay: 0,
            isHoldingAbility: false,
            isHoldingAttack: false,
            lastAttackAngle: 0
        };

        socket.join(roomId);

        // Klientga xonaga muvaffaqiyatli kirganini xabar berish
        // (aks holda menyu paneli lobbi paneliga almashmaydi)
        socket.emit('roomJoined', {
            roomId: roomId,
            roomName: room.name,
            isHost: room.hostId === socket.id
        });

        this.updateLobby(roomId);
        this.broadcastRoomList();
    }

    // Lobbida personaj turini o'zgartirish (Samurai, Mage, Archer, Knight)
    public selectCharacter(socket: Socket, roomId: string, characterType: string): void {
        const room = this.activeRooms[roomId];
        if (room && room.players[socket.id]) {
            room.players[socket.id].characterType = characterType;
            room.players[socket.id].color = CHARACTER_COLORS[characterType] ?? room.players[socket.id].color;
            this.updateLobby(roomId);
        }
    }

    // ENTER/SICHQONCHA BOSIB TURILGANDA: avtomatik-otish holatini yoqamiz
    public startAttack(socket: Socket, roomId: string, angle: number): void {
        const room = this.activeRooms[roomId];
        if (!room || !room.isStarted) return;

        const player = room.players[socket.id];
        if (!player) return;

        player.isHoldingAttack = true;
        player.lastAttackAngle = angle;

        // Bosilgan zahoti, agar imkon bo'lsa, birinchi zarbani darrov beramiz
        this.tryFireAttack(player, room);
    }

    // ENTER/SICHQONCHA QO'YIB YUBORILGANDA: avtomatik-otishni to'xtatamiz
    public stopAttack(socket: Socket, roomId: string): void {
        const room = this.activeRooms[roomId];
        if (!room) return;
        const player = room.players[socket.id];
        if (!player) return;
        player.isHoldingAttack = false;
    }

    // Haqiqiy zarbani berish (stamina va cooldown yetarli bo'lsagina)
    // Bu funksiya ham darhol bosilganda, ham har tikda (auto-fire) chaqiriladi
    public tryFireAttack(player: PlayerState, room: RoomState): void {
        if (player.attackCooldown > 0) return;

        const charLogic = getCharacterLogic(player.characterType);
        if (player.stamina < charLogic.attackStaminaCost) return;

        BaseCharacter.spendStamina(player, charLogic.attackStaminaCost);
        player.attackCooldown = BaseCharacter.ATTACK_COOLDOWN_TICKS;

        charLogic.handleAttack(player, room, player.lastAttackAngle);
    }

    // SHIFT BOSIB TURILGANDA: barcha personajlar uchun umumiy - qobiliyat faollashadi
    public startAbility(socket: Socket, roomId: string): void {
        const room = this.activeRooms[roomId];
        if (!room || !room.isStarted) return;

        const player = room.players[socket.id];
        if (!player) return;
        if (player.stamina <= 0) return; // Stamina tugagan bo'lsa yoqilmaydi

        player.isHoldingAbility = true;
    }

    // SHIFT QO'YIB YUBORILGANDA: qobiliyat effekti bekor qilinadi
    public stopAbility(socket: Socket, roomId: string): void {
        const room = this.activeRooms[roomId];
        if (!room) return;

        const player = room.players[socket.id];
        if (!player) return;

        player.isHoldingAbility = false;
        const charLogic = getCharacterLogic(player.characterType);
        charLogic.releaseHeldAbility(player, room);
    }

    // O'yinchi xonadan chiqib ketganda yoki uzilganda
    public leavePlayer(socket: Socket): void {
        Object.keys(this.activeRooms).forEach((roomId) => {
            const room = this.activeRooms[roomId];
            if (room.players[socket.id]) {
                delete room.players[socket.id];
                socket.leave(roomId);

                // Agar xona egasi (host) chiqib ketsa, xo'jayinlikni boshqasiga beramiz
                if (room.hostId === socket.id) {
                    const remainingPlayers = Object.keys(room.players);
                    if (remainingPlayers.length > 0) {
                        room.hostId = remainingPlayers[0];
                    } else {
                        // Agar xonada hech kim qolmasa, xonani butunlay o'chiramiz
                        delete this.activeRooms[roomId];
                        this.broadcastRoomList();
                        return;
                    }
                }
                this.updateLobby(roomId);
                this.broadcastRoomList();
            }
        });
    }

    // Lobbini yangilash xabari
    public updateLobby(roomId: string): void {
        const room = this.activeRooms[roomId];
        if (!room) return;

        const lobbyData = Object.values(room.players).map(p => ({
            id: p.id,
            characterType: p.characterType,
            isHost: p.id === room.hostId
        }));

        this.io.to(roomId).emit('updateLobbyPlayers', {
            players: lobbyData,
            hostId: room.hostId
        });
    }

    // Asosiy menyudagi hamma o'yinchilarga ochiq xonalar ro'yxatini tarqatish
    public broadcastRoomList(): void {
        const list = Object.values(this.activeRooms).map(r => ({
            id: r.id,
            name: r.name,
            playerCount: Object.keys(r.players).length,
            isStarted: r.isStarted
        }));
        this.io.emit('updateRoomList', list);
    }
}