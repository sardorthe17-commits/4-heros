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
            abilityCooldown: 0,
            abilityDuration: 0,
            stamina: 100,
            attackCooldown: 0,
            isHoldingShield: false
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

    // O'YINCHI OTGANDA (ENTER yoki Sichqoncha bosilganda)
    public handlePlayerAttack(socket: Socket, roomId: string, angle: number): void {
        const room = this.activeRooms[roomId];
        if (!room || !room.isStarted) return;

        const player = room.players[socket.id];
        if (!player) return;

        // Spam qilishning oldini olish: tez-tez ketma-ket bosilsa yoki
        // stamina yetarli bo'lmasa hujum ishlamaydi
        if (player.attackCooldown > 0) return;
        if (player.stamina < BaseCharacter.ATTACK_STAMINA_COST) return;

        player.stamina -= BaseCharacter.ATTACK_STAMINA_COST;
        player.attackCooldown = BaseCharacter.ATTACK_COOLDOWN_TICKS;

        // Factory funksiyamiz orqali personajning shaxsiy klassini olamiz
        const charLogic = getCharacterLogic(player.characterType);
        // O'sha personajning shaxsiy handleAttack logikasi ishga tushadi
        charLogic.handleAttack(player, room, angle);
    }

    // O'YINCHI QOBILIYAT ISHLATGANDA (SHIFT bosilganda)
    public handlePlayerAbility(socket: Socket, roomId: string): void {
        const room = this.activeRooms[roomId];
        if (!room || !room.isStarted) return;

        const player = room.players[socket.id];
        // Agar cooldown tugamagan yoki stamina yetarli bo'lmasa, qobiliyat ishlamaydi
        if (!player || player.abilityCooldown > 0) return;
        if (player.stamina < BaseCharacter.ABILITY_STAMINA_COST) return;

        player.stamina -= BaseCharacter.ABILITY_STAMINA_COST;

        // Har bir personajning shaxsiy SHIFT qobiliyati klassi ishga tushadi
        const charLogic = getCharacterLogic(player.characterType);
        charLogic.handleAbility(player, room);
        
        // Klientga effektlarni chizishi uchun xabar beramiz
        this.io.to(roomId).emit('abilityUsed', { playerId: socket.id, characterType: player.characterType });
    }

    // RITSAR QALQONI: SHIFT bosib turilganda ishga tushadi (faqat Knight uchun)
    public startShield(socket: Socket, roomId: string): void {
        const room = this.activeRooms[roomId];
        if (!room || !room.isStarted) return;

        const player = room.players[socket.id];
        if (!player || player.characterType !== 'knight') return;
        if (player.stamina <= 0) return; // Stamina tugagan bo'lsa yoqilmaydi

        player.isHoldingShield = true;
    }

    // RITSAR QALQONI: SHIFT qo'yib yuborilganda o'chadi
    public stopShield(socket: Socket, roomId: string): void {
        const room = this.activeRooms[roomId];
        if (!room) return;

        const player = room.players[socket.id];
        if (!player) return;

        player.isHoldingShield = false;
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