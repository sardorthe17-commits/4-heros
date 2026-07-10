const socket = io();

// HTML Elementlarni yuklab olamiz
const menuPanel = document.getElementById('menu-panel');
const lobbyPanel = document.getElementById('lobby-panel');
const gameContainer = document.getElementById('game-container');

const roomNameInput = document.getElementById('room-name-input');
const createRoomBtn = document.getElementById('create-room-btn');
const roomListDiv = document.getElementById('room-list');

const currentRoomNameSpan = document.getElementById('current-room-name');
const charSelect = document.getElementById('char-select');
const playerListUl = document.getElementById('player-list');
const playerCountSpan = document.getElementById('player-count');
const startGameBtn = document.getElementById('start-game-btn');
const waitingMsg = document.getElementById('waiting-msg');

let currentRoomId = null;

// --- 1. SEVREDAN RO'YXATLARNI OLISH ---

// Ochiq xonalar ro'yxati yangilanganda
socket.on('updateRoomList', (rooms) => {
    roomListDiv.innerHTML = '';
    if (rooms.length === 0) {
        roomListDiv.innerHTML = '<div style="color: #888; text-align: center;">Hozircha xonalar yo\'q...</div>';
        return;
    }

    rooms.forEach(room => {
        const item = document.createElement('div');
        item.className = 'room-item';
        item.innerHTML = `<span>📂 ${room.name}</span> <span>${room.playerCount}/4 🚪</span>`;
        item.onclick = () => {
            socket.emit('joinRoom', room.id);
        };
        roomListDiv.appendChild(item);
    });
});

// --- 2. XONA YARATISH VA UNGA QO'SHILISH ---

createRoomBtn.onclick = () => {
    const roomName = roomNameInput.value.trim();
    if (!roomName) {
        alert('Iltimos, xona nomini kiriting!');
        return;
    }
    socket.emit('createRoom', roomName);
};

// Lobbiga muvaffaqiyatli kirganda
socket.on('roomJoined', (data) => {
    currentRoomId = data.roomId;
    currentRoomNameSpan.innerText = data.roomName;

    // Panellarni almashtirish
    menuPanel.classList.add('hidden');
    lobbyPanel.classList.remove('hidden');

    // Agar xonani o'zi yaratgan bo'lsa (Host), unga Start tugmasini ko'rsatamiz
    if (data.isHost) {
        startGameBtn.classList.remove('hidden');
        waitingMsg.classList.add('hidden');
    } else {
        startGameBtn.classList.add('hidden');
        waitingMsg.classList.remove('hidden');
    }
});

// Lobbidagi o'yinchilar ro'yxati yangilanganda
socket.on('updateLobbyPlayers', (data) => {
    playerListUl.innerHTML = '';
    playerCountSpan.innerText = data.players.length;

    data.players.forEach(p => {
        const li = document.createElement('li');
        li.style.color = p.id === socket.id ? '#00ffcc' : '#fff';
        li.style.marginBottom = '5px';
        li.innerText = `${p.id === socket.id ? '⭐ Siz' : '👤 O\'yinchi'} [${p.characterType.toUpperCase()}]`;
        playerListUl.appendChild(li);
    });
});

// --- 3. QAXRAMONNI TANLASH VA START ---

charSelect.onchange = () => {
    socket.emit('selectCharacter', {
        roomId: currentRoomId,
        characterType: charSelect.value
    });
};

// O'yinni boshlash (Faqat Host bosa oladi)
startGameBtn.onclick = () => {
    socket.emit('requestStartGame', currentRoomId);
};

// Server o'yin boshlandi deb buyruq berganda Phaser'ni yoqamiz
socket.on('gameStarted', () => {
    lobbyPanel.classList.add('hidden');
    gameContainer.classList.remove('hidden');

    // game.js ichidagi Phadser o'yinini ishga tushirish funksiyasi
    if (typeof launchGame === 'function') {
        launchGame(socket, currentRoomId);
    }
});