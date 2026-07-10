let currentCharacter;
let otherPlayers = {};
let enemyBots = {}; 
let bulletSprites = {}; 
let cursors;
let platforms; 
let lastDirection = 'right';

// Bu funksiya lobby.js ichida xona egasi Start bosganda chaqiriladi
function launchGame(socket, roomId) {

    const config = {
        type: Phaser.AUTO,
        width: 800,
        height: 600,
        parent: 'game-container', // O'yin aynan index.html dagi shu div ichiga tushadi
        physics: {
            default: 'arcade',
            arcade: {
                gravity: { y: 600 },
                debug: false
            }
        },
        scene: { preload: preload, create: create, update: update }
    };

    const game = new Phaser.Game(config);

    function preload() {}

    function createSquareTexture(scene, key, color, size = 32) {
        if (!scene.textures.exists(key)) {
            const rect = scene.add.graphics();
            rect.fillStyle(color, 1);
            rect.fillRect(0, 0, size, size);
            rect.generateTexture(key, size, size);
            rect.destroy();
        }
    }

    // ROBOT (BOT) TEKSTURASI: to'q ko'k-yashil tanasi + oq "ko'z/visor" chizig'i
    function createBotTexture(scene, key, color, size = 32) {
        if (!scene.textures.exists(key)) {
            const g = scene.add.graphics();
            g.fillStyle(color, 1);
            g.fillRect(0, 0, size, size);
            // Oq rangli visor (ko'rish chizig'i) - robot ko'rinishini beradi
            g.fillStyle(0xffffff, 1);
            g.fillRect(4, size * 0.35, size - 8, 5);
            g.generateTexture(key, size, size);
            g.destroy();
        }
    }

    // RITSAR QALQONI: "]" shaklidagi chiziqli qalqon effekti
    function drawBracketShield(gfx, x, y, facingRight) {
        gfx.clear();
        gfx.lineStyle(5, 0x00aaff, 0.95);
        const offset = facingRight ? 22 : -22;
        const tick = facingRight ? -9 : 9;
        const sx = x + offset;

        gfx.beginPath();
        gfx.moveTo(sx, y - 20);
        gfx.lineTo(sx, y + 20);            // Vertikal chiziq
        gfx.moveTo(sx, y - 20);
        gfx.lineTo(sx + tick, y - 20);      // Yuqori "tirnoq"
        gfx.moveTo(sx, y + 20);
        gfx.lineTo(sx + tick, y + 20);      // Pastki "tirnoq"
        gfx.strokePath();
    }

    // JON CHIZIG'INI CHIZISH FUNKSIYASI
    function drawHealthBar(scene, sprite, hp) {
        if (!sprite.healthBar) {
            sprite.healthBar = scene.add.graphics();
        }
        sprite.healthBar.clear();
        
        if (hp <= 0) return;

        // Qizil fon
        sprite.healthBar.fillStyle(0xff0000, 1);
        sprite.healthBar.fillRect(sprite.x - 16, sprite.y - 12, 32, 5);

        // Yashil jon
        sprite.healthBar.fillStyle(0x00ff00, 1);
        const healthWidth = (hp / 100) * 32;
        sprite.healthBar.fillRect(sprite.x - 16, sprite.y - 12, healthWidth, 5);
    }

    // O'ZINING JON (HP) VA STAMINA HUD PANELI: ekran chetida, sobit joyda
    function drawHUD(scene, hp, stamina) {
        if (!scene.hudGfx) {
            scene.hudGfx = scene.add.graphics().setScrollFactor(0).setDepth(1000);
            scene.hudText = scene.add.text(24, 44, '', {
                font: 'bold 14px Arial',
                fill: '#ffffff'
            }).setScrollFactor(0).setDepth(1001);
            scene.hudLabel = scene.add.text(20, 16, 'HP', {
                font: 'bold 16px Arial',
                fill: '#ffffff'
            }).setScrollFactor(0).setDepth(1001);
            scene.staminaLabel = scene.add.text(20, 66, 'STAMINA', {
                font: 'bold 12px Arial',
                fill: '#ffdd55'
            }).setScrollFactor(0).setDepth(1001);
        }

        const safeHp = Math.max(0, hp);
        const safeStamina = Math.max(0, stamina === undefined ? 100 : stamina);

        scene.hudGfx.clear();
        // --- HP chizig'i ---
        scene.hudGfx.fillStyle(0x222222, 0.85);
        scene.hudGfx.fillRect(20, 38, 204, 18);
        scene.hudGfx.fillStyle(0xff0000, 1);
        scene.hudGfx.fillRect(22, 40, 200, 14);
        scene.hudGfx.fillStyle(0x00ff00, 1);
        scene.hudGfx.fillRect(22, 40, (safeHp / 100) * 200, 14);
        scene.hudGfx.lineStyle(2, 0xffffff, 1);
        scene.hudGfx.strokeRect(20, 38, 204, 18);

        // --- Stamina chizig'i (sariq) ---
        scene.hudGfx.fillStyle(0x222222, 0.85);
        scene.hudGfx.fillRect(20, 84, 204, 12);
        scene.hudGfx.fillStyle(0x555555, 1);
        scene.hudGfx.fillRect(22, 86, 200, 8);
        scene.hudGfx.fillStyle(0xffdd55, 1);
        scene.hudGfx.fillRect(22, 86, (safeStamina / 100) * 200, 8);
        scene.hudGfx.lineStyle(2, 0xffffff, 1);
        scene.hudGfx.strokeRect(20, 84, 204, 12);

        scene.hudText.setText(Math.round(safeHp) + ' / 100');
    }

    function create() {
        // Klaviatura tugmalarini eshitish
        cursors = this.input.keyboard.createCursorKeys();

        // Yerni (platforma) chizish
        platforms = this.physics.add.staticGroup();
        let ground = this.add.rectangle(400, 585, 800, 30, 0x333333);
        platforms.add(ground);

        // --- BARCHA O'Q VA QILICH TEKSTURALARINI 1 MARTA YARATIB OLISh ---
        // 1. Ritsar qilich zarbasi: to'g'ri, kulrang tig' + sariq gard (tutqich)
        if (!this.textures.exists('melee_knight')) {
            let g = this.add.graphics();
            // Tig' (to'g'ri, kumushrang)
            g.fillStyle(0xd8d8d8, 1);
            g.fillRect(6, 2, 34, 6);
            // Gard (tutqich ko'ndalang chizig'i, sariq)
            g.fillStyle(0xffcc00, 1);
            g.fillRect(2, 0, 6, 10);
            g.generateTexture('melee_knight', 40, 10); g.destroy();
        }
        // 2. Samuray katana zarbasi: egik, qizil tig' + qora dastasi
        if (!this.textures.exists('melee_samurai')) {
            let g = this.add.graphics();
            g.fillStyle(0xe53935, 1);
            // Egik tig'ni bir nechta segmentlar bilan simulyatsiya qilamiz
            g.fillRect(8, 4, 30, 4);
            g.fillRect(30, 1, 10, 4);
            g.fillRect(36, 0, 6, 3);
            // Qora dasta
            g.fillStyle(0x1a1a1a, 1);
            g.fillRect(0, 3, 8, 5);
            g.generateTexture('melee_samurai', 45, 8); g.destroy();
        }
        // 3. Kamon o'qi: cho'zilgan strela - yog'och tanasi + metall uchi + pat (fletching)
        if (!this.textures.exists('projectile_arrow')) {
            let g = this.add.graphics();
            // Yog'ochsimon tanasi (jigarrang, cho'zilgan)
            g.fillStyle(0x8b5a2b, 1);
            g.fillRect(6, 7, 28, 3);
            // Old tomonidagi metall uchi (uchburchak)
            g.fillStyle(0xdddddd, 1);
            g.fillTriangle(32, 3.5, 32, 13.5, 42, 8.5);
            // Orqadagi patlar (fletching)
            g.fillStyle(0xdd3333, 1);
            g.fillTriangle(2, 8.5, 10, 2, 10, 8.5);
            g.fillTriangle(2, 8.5, 10, 15, 10, 8.5);
            g.generateTexture('projectile_arrow', 42, 17); g.destroy();
        }
        // 4. Sehrgar olovli shari: qatlamli doiralar bilan porlab turgan olov effekti
        if (!this.textures.exists('projectile_fireball')) {
            let g = this.add.graphics();
            const cx = 13, cy = 13;
            g.fillStyle(0xff6600, 0.35);
            g.fillCircle(cx, cy, 13); // Tashqi shaffof porlash
            g.fillStyle(0xff4500, 0.95);
            g.fillCircle(cx, cy, 8.5); // O'rta olov qatlami
            g.fillStyle(0xffcc00, 1);
            g.fillCircle(cx, cy, 4.5); // Ichki yorqin yadro
            g.generateTexture('projectile_fireball', 26, 26); g.destroy();
        }
        // 5. Standart o'q (Agar kerak bo'lib qolsa)
        if (!this.textures.exists('projectile_normal')) {
            let g = this.add.graphics();
            g.fillStyle(0xffffff, 1); g.fillRect(0, 0, 8, 8);
            g.generateTexture('projectile_normal', 8, 8); g.destroy();
        }
        // Serverdan javob kelganda qahramonni yaratish
        socket.on('initPlayer', (data) => {
            if (currentCharacter) return; // Agar allaqachon yaratilgan bo'lsa, qayta yaratma

            const textureKey = `char_${data.characterType}`;
            createSquareTexture(this, textureKey, data.color, 32);
            
            currentCharacter = this.physics.add.sprite(data.x, data.y, textureKey);
            currentCharacter.setCollideWorldBounds(true);
            this.physics.add.collider(currentCharacter, platforms);
            currentCharacter.hp = data.hp || 100;
            currentCharacter.characterType = data.characterType;
            
            console.log("Qahramon muvaffaqiyatli yaratildi va harakatga tayyor:", currentCharacter);
        });

        // DIQQAT: Phaser to'liq yuklanib bo'ldi, endi serverdan o'yinchimizni so'raymiz!
        socket.emit('playerReadyInRoom', roomId);
        this.input.keyboard.on('keydown-SHIFT', () => {
            if (!currentCharacter) return;
            if (currentCharacter.characterType === 'knight') {
                // Ritsar: bosib turilgancha qalqon faol, stamina ketaveradi
                socket.emit('startShieldInRoom', roomId);
            } else {
                // Boshqa personajlar: bir marta bosilganda ishlaydigan qobiliyat
                socket.emit('useAbilityInRoom', { roomId: roomId });
            }
        });
        this.input.keyboard.on('keyup-SHIFT', () => {
            if (!currentCharacter) return;
            if (currentCharacter.characterType === 'knight') {
                // Qo'yib yuborilganda qalqon o'chadi, stamina tiklana boshlaydi
                socket.emit('stopShieldInRoom', roomId);
            }
        });
        // Xavfsizlik: brauzer tabidan chiqib ketilsa ham qalqon "yopishib qolmasin"
        window.addEventListener('blur', () => {
            if (currentCharacter && currentCharacter.characterType === 'knight') {
                socket.emit('stopShieldInRoom', roomId);
            }
        });
        // ENTER bosilganda otish
        this.input.keyboard.on('keydown-ENTER', () => {
            if (!currentCharacter) return;
            let angle = (lastDirection === 'right') ? 0 : Math.PI; 
            socket.emit('playerAttackInRoom', { roomId: roomId, angle: angle });
        });

        // SICHQONCHA bosilganda otish
        this.input.on('pointerdown', () => {
            if (!currentCharacter) return;
            let angle = (lastDirection === 'right') ? 0 : Math.PI; 
            socket.emit('playerAttackInRoom', { roomId: roomId, angle: angle });
        });

        // SERVERDAN DUNYO YANGILANISHINI ESHITISH
        socket.on('gameStateUpdate', (data) => {
            const serverPlayers = data.players;
            const serverBots = data.bots || [];
            const serverBullets = data.bullets || [];

            // 1. O'ZIMIZNING PERSONAJ HOLATI (Tezlik va effektlar)
            if (currentCharacter && serverPlayers[socket.id]) {
                const myData = serverPlayers[socket.id];
                currentCharacter.hp = myData.hp;
                currentCharacter.stamina = myData.stamina;
                
                currentCharacter.speedMultiplier = myData.speedMultiplier || 1;

                if (myData.isInvisible) {
                    currentCharacter.setAlpha(0.4);
                } else {
                    currentCharacter.setAlpha(1);
                }

                if (myData.characterType === 'knight' && myData.isHoldingShield) {
                    currentCharacter.setTint(0x00aaff);
                    currentCharacter.shieldActive = true;
                } else {
                    currentCharacter.clearTint();
                    currentCharacter.shieldActive = false;
                }

                if (myData.x === 100 && Math.abs(currentCharacter.x - 100) > 200) {
                    currentCharacter.x = myData.x; currentCharacter.y = myData.y;
                }
            }

            // [YANGI QO'SHILDI]: 2. BOSHQA O'YINCHILARNI YARATISH VA YANGILASH
            Object.keys(serverPlayers).forEach((id) => {
                if (id === socket.id) return; // O'zimizni tashlab o'tamiz
                
                const pData = serverPlayers[id];
                const textureKey = `char_${pData.characterType}`;

                // Agar bu o'yinchi uchun tekstura yo'q bo'lsa, uning rangida yaratamiz
                createSquareTexture(this, textureKey, pData.color, 32);

                if (!otherPlayers[id]) {
                    // Yangi o'yinchini ekranga qo'shish
                    let p = this.add.sprite(pData.x, pData.y, textureKey);
                    p.targetX = pData.x; 
                    p.targetY = pData.y; 
                    p.hp = pData.hp;
                    otherPlayers[id] = p;
                } else {
                    // Mavjud o'yinchi ma'lumotlarini yangilash
                    if (otherPlayers[id].texture.key !== textureKey) {
                        otherPlayers[id].setTexture(textureKey);
                    }
                    otherPlayers[id].targetX = pData.x;
                    otherPlayers[id].targetY = pData.y;
                    otherPlayers[id].hp = pData.hp;
                }

                // Archer ko'rinmas bo'lsa boshqalarga ko'rinmaydi
                if (pData.isInvisible) {
                    otherPlayers[id].setAlpha(0);
                    if (otherPlayers[id].healthBar) otherPlayers[id].healthBar.clear();
                } else {
                    otherPlayers[id].setAlpha(1);
                }

                // Knight qalqoni effekti
                if (pData.characterType === 'knight' && pData.isHoldingShield) {
                    otherPlayers[id].setTint(0x00aaff);
                    otherPlayers[id].shieldActive = true;
                } else {
                    if (!pData.isInvisible) otherPlayers[id].clearTint();
                    otherPlayers[id].shieldActive = false;
                }
            });

            // [YANGI QO'SHILDI]: XONADAN CHIQIB KETGAN O'YINCHILARNI TOZALASH
            Object.keys(otherPlayers).forEach((id) => {
                if (!serverPlayers[id]) {
                    if (otherPlayers[id].healthBar) otherPlayers[id].healthBar.destroy();
                    if (otherPlayers[id].shieldGfx) otherPlayers[id].shieldGfx.destroy();
                    otherPlayers[id].destroy();
                    delete otherPlayers[id];
                }
            });

            // 3. O'CHIB KETGAN BOTLARNI TOZALASH (BOT O'LGANDA ANIMATSIYA)
            Object.keys(enemyBots).forEach((id) => {
                const exists = serverBots.some(b => b.id === id);
                if (!exists) {
                    let deadBot = enemyBots[id];
                    if (deadBot.healthBar) deadBot.healthBar.destroy();
                    
                    this.tweens.add({
                        targets: deadBot,
                        alpha: 0,
                        scale: 1.5,
                        duration: 200,
                        onComplete: () => {
                            deadBot.destroy();
                        }
                    });
                    
                    delete enemyBots[id];
                }
            });

            // Botlarni yangilash va zarar yeganda miltillatish
            serverBots.forEach((bot) => {
                if (!enemyBots[bot.id]) {
                    createBotTexture(this, 'bot_texture_' + bot.color, bot.color, 32);
                    let b = this.add.sprite(bot.x, bot.y, 'bot_texture_' + bot.color);
                    b.targetX = bot.x; b.targetY = bot.y; b.hp = bot.hp;
                    enemyBots[bot.id] = b;
                } else {
                    if (enemyBots[bot.id].hp > bot.hp) {
                        enemyBots[bot.id].setTint(0xffffff);
                        this.time.delayedCall(100, () => {
                            if (enemyBots[bot.id]) {
                                if (bot.freezeDuration > 0) enemyBots[bot.id].setTint(0x00ffff);
                                else enemyBots[bot.id].clearTint();
                            }
                        });
                    }
                    enemyBots[bot.id].targetX = bot.x;
                    enemyBots[bot.id].targetY = bot.y;
                    enemyBots[bot.id].hp = bot.hp;
                }
            });

            // 4. O'QLARNI YANGILASH
            Object.keys(bulletSprites).forEach((id) => {
                const exists = serverBullets.some(b => b.id === id);
                if (!exists) {
                    bulletSprites[id].destroy();
                    delete bulletSprites[id];
                }
            });

            // O'QLAR VA QILICH ZARBALARINI CHIZISH
            serverBullets.forEach((bData) => {
                if (!bulletSprites[bData.id]) {
                    const shooter = serverPlayers[bData.playerId];
                    let currentTexture = 'projectile_normal';

                    if (shooter) {
                        if (shooter.characterType === 'knight') currentTexture = 'melee_knight';
                        else if (shooter.characterType === 'samurai') currentTexture = 'melee_samurai';
                        else if (shooter.characterType === 'archer') currentTexture = 'projectile_arrow';
                        else if (shooter.characterType === 'mage') currentTexture = 'projectile_fireball';
                    }

                    let bSprite = this.physics.add.sprite(bData.x, bData.y, currentTexture);
                    if (bSprite.body) bSprite.body.setAllowGravity(false);
                    // Chapga qarab hujum qilinganda qurol tasvirini gorizontal aylantirish
                    const facingLeft = bData.vx < 0;
                    if (facingLeft) bSprite.setFlipX(true);
                    const dir = facingLeft ? -1 : 1;

                    if (currentTexture === 'melee_knight') {
                        // RITSAR: tepadan pastga qarab zarba (dastasi yaqinida pivot)
                        bSprite.setOrigin(0.15, 0.5);
                        bSprite.angle = dir * -70; // Yuqoriga ko'tarilgan holatdan boshlaydi
                        this.tweens.add({
                            targets: bSprite,
                            angle: dir * 25, // Pastga qarab tez tushadi
                            duration: 160,
                            ease: 'Cubic.Out'
                        });
                    } else if (currentTexture === 'melee_samurai') {
                        // SAMURAY: keng yoysimon gorizontal/diagonal kesish
                        bSprite.setOrigin(0.1, 0.5);
                        bSprite.angle = dir * -40;
                        this.tweens.add({
                            targets: bSprite,
                            angle: dir * 40,
                            duration: 130,
                            ease: 'Sine.Out'
                        });
                    }

                    bulletSprites[bData.id] = bSprite;
                } else {
                    bulletSprites[bData.id].x = bData.x;
                    bulletSprites[bData.id].y = bData.y;
                }
            });
        });
    }

    function update() {
        // O'yinchilarni siljitish va joni
        Object.keys(otherPlayers).forEach((id) => {
            let p = otherPlayers[id];
            if (p && p.active && p.targetX !== undefined) {
                const movingRight = p.targetX >= p.x;
                p.x = Phaser.Math.Linear(p.x, p.targetX, 0.22);
                p.y = Phaser.Math.Linear(p.y, p.targetY, 0.4);
                drawHealthBar(this, p, p.hp);

                if (p.shieldActive) {
                    if (!p.shieldGfx) p.shieldGfx = this.add.graphics();
                    drawBracketShield(p.shieldGfx, p.x, p.y, movingRight);
                } else if (p.shieldGfx) {
                    p.shieldGfx.clear();
                }
            }
        });

        // Botlarni siljitish va joni
        Object.keys(enemyBots).forEach((id) => {
            let b = enemyBots[id];
            if (b && b.active && b.targetX !== undefined) {
                b.x = Phaser.Math.Linear(b.x, b.targetX, 0.22);
                b.y = Phaser.Math.Linear(b.y, b.targetY, 0.4);
                drawHealthBar(this, b, b.hp);
            }
        });

        // O'zimizning qahramon joni: endi boshi ustida emas, ekran chetidagi HUD panelida
        if (currentCharacter && currentCharacter.active) {
            drawHUD(this, currentCharacter.hp, currentCharacter.stamina);

            if (currentCharacter.shieldActive) {
                if (!currentCharacter.shieldGfx) currentCharacter.shieldGfx = this.add.graphics();
                drawBracketShield(currentCharacter.shieldGfx, currentCharacter.x, currentCharacter.y, lastDirection === 'right');
            } else if (currentCharacter.shieldGfx) {
                currentCharacter.shieldGfx.clear();
            }
        }

        if (!currentCharacter || !currentCharacter.body) return;
        
        // Standart tezlik 200, agar Samurai qobiliyati faol bo'lsa speedMultiplier ko'paytiriladi
        let currentMultiplier = currentCharacter.speedMultiplier || 1;
        let speed = 200 * currentMultiplier;

        if (cursors.left.isDown || this.input.keyboard.addKey('A').isDown) {
            currentCharacter.setVelocityX(-speed);
            lastDirection = 'left';
        } else if (cursors.right.isDown || this.input.keyboard.addKey('D').isDown) {
            currentCharacter.setVelocityX(speed);
            lastDirection = 'right';
        } else {
            currentCharacter.setVelocityX(0);
        }

        const isGrounded = currentCharacter.body.touching.down || currentCharacter.body.blocked.down;
        if ((cursors.up.isDown || this.input.keyboard.addKey('W').isDown) && isGrounded) {
            currentCharacter.setVelocityY(-400); 
        }

        // Harakat koordinatalarini faqat o'z xonamizga yuboramiz
        socket.emit('playerMoveInRoom', { roomId: roomId, x: currentCharacter.x, y: currentCharacter.y });
    }
}