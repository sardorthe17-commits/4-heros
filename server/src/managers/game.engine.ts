import { Server } from 'socket.io';
import { RoomState, PlayerState } from '../types'
import { BaseCharacter } from '../characters/base.character';
import { getCharacterLogic } from '../characters';

export class GameEngine {
    private io: Server;
    private activeRooms: { [key: string]: RoomState };
    private loopInterval: NodeJS.Timeout | null = null;

    private readonly GROUND_Y = 555;
    private readonly GRAVITY = 15;
    private readonly BOT_SPEED = 2;

    constructor(io: Server, activeRooms: { [key: string]: RoomState }) {
        this.io = io;
        this.activeRooms = activeRooms;
    }

    // O'yin siklini (Tick loop) ishga tushirish (30ms xuddi sizda bo'lganidek)
    public start(): void {
        if (this.loopInterval) return;
        
        this.loopInterval = setInterval(() => {
            this.update();
        }, 30);
    }

    private update(): void {
        Object.keys(this.activeRooms).forEach(roomId => {
            const room = this.activeRooms[roomId];
            if (!room.isStarted) return;

            // 1. O'YINCHILAR TAYMERLARINI YANGILASH + USHLAB TURILGAN AMALLAR
            Object.values(room.players).forEach((player) => {
                const charLogic = getCharacterLogic(player.characterType);
                const wasHoldingAbility = player.isHoldingAbility;

                BaseCharacter.updateTimers(player);

                // Agar stamina tugab, updateTimers o'zi majburiy o'chirgan bo'lsa
                // (masalan, Samuray tezligini SHIFT qo'yib yubormasdan tugatgan bo'lsa),
                // personajning shaxsiy effektini ham darhol bekor qilishimiz kerak,
                // aks holda tezlik/ko'rinmaslik "yopishib qolib" davom etaveradi
                if (wasHoldingAbility && !player.isHoldingAbility) {
                    charLogic.releaseHeldAbility(player, room);
                }

                // SHIFT ushlab turilgan bo'lsa, har tikda personajning maxsus
                // effektini qo'llaymiz (ko'rinmaslik, tezlik, muzlatish va h.k.)
                if (player.isHoldingAbility && player.stamina > 0) {
                    charLogic.applyHeldAbility(player, room);
                }

                // ENTER/SICHQONCHA ushlab turilgan bo'lsa - avtomatik otish
                // (stamina va cooldown yetarli bo'lgandagina zarba beriladi)
                if (player.isHoldingAttack) {
                    if (player.attackCooldown <= 0 && player.stamina >= charLogic.attackStaminaCost) {
                        BaseCharacter.spendStamina(player, charLogic.attackStaminaCost);
                        player.attackCooldown = BaseCharacter.ATTACK_COOLDOWN_TICKS;
                        charLogic.handleAttack(player, room, player.lastAttackAngle);
                    }
                }
            });

            // 2. BOTLAR FIZIKASI VA SHeLLI AI
            this.updateBots(room);

            // 3. O'QLAR VA TO'QNASHUVLAR
            this.updateBullets(room);

            // 4. BOTLAR TUGASA RESPRAWN
            this.checkBotRespawn(room, roomId);

            // 5. HOLATNI LOBBIGA BROADCAST QILISh
            this.io.to(roomId).emit('gameStateUpdate', {
                players: room.players,
                bots: room.bots,
                bullets: room.bullets
            });
        });
    }

    private updateBots(room: RoomState): void {
        room.bots.forEach((bot) => {
            // Agar bot muzlagan bo'lsa qotib turadi
            if (bot.freezeDuration > 0) {
                bot.freezeDuration--;
                return;
            }

            // Gravitatsiya
            if (bot.y < this.GROUND_Y) bot.y += this.GRAVITY;
            if (bot.y > this.GROUND_Y) bot.y = this.GROUND_Y;

            // Eng yaqin o'yinchini topish (ko'rinmas bo'lmagan)
            let closestPlayer: PlayerState | null = null;
            let minDistance = Infinity;

            Object.values(room.players).forEach((player) => {
                if (player.isInvisible) return; // Archer ko'rinmas bo'lsa bot e'tibor bermaydi

                const dist = Math.sqrt(Math.pow(player.x - bot.x, 2) + Math.pow(player.y - bot.y, 2));
                if (dist < minDistance) {
                    minDistance = dist;
                    closestPlayer = player;
                }
            });

            // O'yinchi tomonga yurish va zarar berish
            if (closestPlayer && bot.y === this.GROUND_Y) {
                // TypeScript'ga p aniq PlayerState ekanligini majburlab ko'rsatamiz:
                const p = closestPlayer as PlayerState; 

                if (bot.x < p.x - 5) bot.x += this.BOT_SPEED;
                else if (bot.x > p.x + 5) bot.x -= this.BOT_SPEED;

                if (this.checkOverlap({ x: bot.x, y: bot.y, w: 32, h: 32 }, { x: p.x, y: p.y, w: 32, h: 32 })) {
                    // Knight qalqoni tekshiruvi: endi isHoldingAbility orqali (bosib turilgancha himoya qiladi)
                    if (p.characterType === 'knight' && p.isHoldingAbility) {
                        // Qalqon faol, zarar yetmaydi
                    } else {
                        p.hp -= 0.5;
                    }

                    if (p.hp <= 0) {
                        p.hp = 100; 
                        p.x = 100; 
                        p.y = 500;
                        p.isInvisible = false;
                        p.speedMultiplier = 1;
                        p.isHoldingAbility = false;
                        p.isHoldingAttack = false;
                        p.stamina = 100;
                        p.staminaRegenDelay = 0;
                    }
                }
            }
        });

        // BOTLAR BIR-BIRINING ICHIGA KIRIB KETMASLIGI UCHUN
        // (ular orasidagi to'qnashuvni tekshirib, kerak bo'lsa ajratib qo'yamiz)
        this.resolveBotCollisions(room);
    }

    // Har bir bot juftligini tekshirib, agar ustma-ust tushsa, bir-biridan itarib ajratamiz
    private resolveBotCollisions(room: RoomState): void {
        const BOT_WIDTH = 32;

        for (let i = 0; i < room.bots.length; i++) {
            for (let j = i + 1; j < room.bots.length; j++) {
                const a = room.bots[i];
                const b = room.bots[j];

                if (this.checkOverlap(
                    { x: a.x, y: a.y, w: BOT_WIDTH, h: BOT_WIDTH },
                    { x: b.x, y: b.y, w: BOT_WIDTH, h: BOT_WIDTH }
                )) {
                    const overlap = BOT_WIDTH - Math.abs(a.x - b.x);
                    if (overlap > 0) {
                        const push = overlap / 2;
                        if (a.x < b.x) {
                            a.x -= push;
                            b.x += push;
                        } else if (a.x > b.x) {
                            a.x += push;
                            b.x -= push;
                        } else {
                            // Aynan bir xil x'da bo'lsa, tasodifiy tomonlarga itaramiz
                            a.x -= push;
                            b.x += push;
                        }
                    }
                }
            }
        }
    }

    private updateBullets(room: RoomState): void {
        for (let i = room.bullets.length - 1; i >= 0; i--) {
            const bullet = room.bullets[i];
            bullet.x += bullet.vx * 0.03;
            bullet.y += bullet.vy * 0.03;
            bullet.lifetime--;

            let bulletDestroyed = false;

            // Qilich/katana zarbalari uchun ancha kattaroq hitbox ishlatamiz,
            // chunki vizual tasvirdagi tig' uzun va yoysimon harakat qiladi -
            // kichik nuqta shaklidagi hitbox ko'p hollarda tegmay o'tib ketardi
            const isMelee = bullet.bulletType === 'melee';
            const hitW = isMelee ? 54 : 8;
            const hitH = isMelee ? 44 : 8;
            const hitX = isMelee ? bullet.x - hitW / 2 : bullet.x;
            const hitY = isMelee ? bullet.y - hitH / 2 : bullet.y;

            for (let j = room.bots.length - 1; j >= 0; j--) {
                const bot = room.bots[j];
                if (this.checkOverlap({ x: hitX, y: hitY, w: hitW, h: hitH }, { x: bot.x, y: bot.y, w: 32, h: 32 })) {
                    
                    // Har bir o'q turiga qarab shaxsiy zarar miqdori (yangi balans)
                    if (bullet.bulletType === 'fireball') bot.hp -= 30;       // Sehrgar: kuchli, lekin stamina tez ketadi
                    else if (bullet.bulletType === 'arrow') bot.hp -= 10;     // Kamonchi: yengil zarba
                    else if (bullet.bulletType === 'melee') bot.hp -= 20;     // Ritsar/Samuray: o'rtacha, stamina sekin ketadi
                    else bot.hp -= 20;

                    bulletDestroyed = true;
                    if (bot.hp <= 0) room.bots.splice(j, 1);
                    break;
                }
            }

            if (bulletDestroyed || bullet.lifetime <= 0 || bullet.x < 0 || bullet.x > 800 || bullet.y < 0 || bullet.y > 600) {
                room.bullets.splice(i, 1);
            }
        }
    }

    private checkBotRespawn(room: RoomState, roomId: string): void {
        if (room.bots.length === 0) {
            room.bots = [
                { id: roomId + '_bot_1', x: 300, y: 555, color: 0x0f4c4c, hp: 100, freezeDuration: 0 },
                { id: roomId + '_bot_2', x: 500, y: 555, color: 0x0f4c4c, hp: 100, freezeDuration: 0 },
                { id: roomId + '_bot_3', x: 650, y: 555, color: 0x0f4c4c, hp: 100, freezeDuration: 0 }
            ];
        }
    }

    private checkOverlap(rect1: any, rect2: any): boolean {
        return rect1.x < rect2.x + rect2.w &&
               rect1.x + rect1.w > rect2.x &&
               rect1.y < rect2.y + rect2.h &&
               rect1.y + rect1.h > rect2.y;
    }
}