import express from 'express';
import http from 'http';
import path from 'path';
import { Server } from 'socket.io';
import cors from 'cors';
import { RoomState } from './types';
import { RoomManager } from './managers/room.manager';
import { GameEngine } from './managers/game.engine';
import { ConfigService } from '@nestjs/config';

const app = express();
app.use(cors());

// Client papkasidagi fayllarni (index.html, game.js, lobby.js) serve qilish
app.use(express.static(path.join(__dirname, '../../client')));

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

// Barcha o'yin xonalari shu yerda saqlanadi
const activeRooms: { [key: string]: RoomState } = {};

// Menejerlarni xonalarni ulashgan holda yaratamiz
const roomManager = new RoomManager(io, activeRooms);
const gameEngine = new GameEngine(io, activeRooms);

// O'yin siklini (Tick loop) fonda ishga tushiramiz
gameEngine.start();

io.on('connection', (socket) => {
    console.log(`Foydalanuvchi ulandi: ${socket.id}`);

    // Yangi ulanish bo'lganda mavjud xonalar ro'yxatini yuborish
    roomManager.broadcastRoomList();

    // 1. XONA YARATISH
    socket.on('createRoom', (roomName: string) => {
        const roomId = 'room_' + Math.random().toString(36).substring(2, 9);
        activeRooms[roomId] = {
            id: roomId,
            name: roomName,
            hostId: socket.id,
            players: {},
            bots: [],
            bullets: [],
            bulletIdCounter: 0,
            isStarted: false
        };

        roomManager.joinPlayer(socket, roomId);
    });

    // 2. XONAGA QO'SHILISH
    socket.on('joinRoom', (roomId: string) => {
        if (activeRooms[roomId]) {
            roomManager.joinPlayer(socket, roomId);
        } else {
            socket.emit('error', 'Xona topilmadi!');
        }
    });

    // 3. LOBBIDA PERSONAJ TANLASH
    socket.on('selectCharacter', (data: { roomId: string, characterType: string }) => {
        roomManager.selectCharacter(socket, data.roomId, data.characterType);
    });

    // 4. ADMIN O'YINNI BOSHLAGANDA
    socket.on('requestStartGame', (roomId: string) => {
        const room = activeRooms[roomId];
        if (room && room.hostId === socket.id) {
            room.isStarted = true;
            
            // Boshlang'ich botlar ro'yxati
            room.bots = [
                { id: roomId + '_bot_1', x: 300, y: 555, color: 0x0f4c4c, hp: 100, freezeDuration: 0 },
                { id: roomId + '_bot_2', x: 500, y: 555, color: 0x0f4c4c, hp: 100, freezeDuration: 0 },
                { id: roomId + '_bot_3', x: 650, y: 555, color: 0x0f4c4c, hp: 100, freezeDuration: 0 }
            ];

            io.to(roomId).emit('gameStarted');
            roomManager.broadcastRoomList(); 
        }
    });

    // 5. PHASER YUKLANIB BO'LGACH O'YINCHINI ISHGA TUSHIRISH
    socket.on('playerReadyInRoom', (roomId: string) => {
        const room = activeRooms[roomId];
        if (room && room.players[socket.id]) {
            socket.emit('initPlayer', room.players[socket.id]);
        }
    });

    // 6. HARAKAT KOORDINATALARINI SERVER BILAN SINXRONLASH
    socket.on('playerMoveInRoom', (data: { roomId: string, x: number, y: number }) => {
        const room = activeRooms[data.roomId];
        if (room && room.players[socket.id]) {
            room.players[socket.id].x = data.x;
            room.players[socket.id].y = data.y;
        }
    });

    // 7. STANDART HUJUM (ENTER / SICHQONCHA) - endi bosib turish tizimi
    socket.on('startAttackInRoom', (data: { roomId: string, angle: number }) => {
        roomManager.startAttack(socket, data.roomId, data.angle);
    });
    socket.on('stopAttackInRoom', (roomId: string) => {
        roomManager.stopAttack(socket, roomId);
    });

    // 8. MAXSUS QOBILIYAT (SHIFT) - barcha personajlar uchun bosib turish tizimi
    socket.on('startAbilityInRoom', (roomId: string) => {
        roomManager.startAbility(socket, roomId);
    });
    socket.on('stopAbilityInRoom', (roomId: string) => {
        roomManager.stopAbility(socket, roomId);
    });

    // 9. TARMOQDAN UZILISH
    socket.on('disconnect', () => {
        console.log(`Foydalanuvchi uzildi: ${socket.id}`);
        roomManager.leavePlayer(socket);
    });
});
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server professional modda ${PORT}-portda ishlamoqda.`);
});