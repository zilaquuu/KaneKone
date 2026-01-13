const WebSocket = require('ws');

// Ambil PORT dari Render.com atau default 8080
const wss = new WebSocket.Server({ port: process.env.PORT || 8080 });

// Penyimpanan sementara Room (Memory Only)
// Format: { "NamaRoom": [Client1, Client2] }
const rooms = {};

console.log("KaneKone Matrix Server Started...");

wss.on('connection', (ws) => {
    ws.room = null; // Player belum masuk room

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            // --- TIPE 1: JOIN ROOM ---
            if (data.type === 'JOIN') {
                const roomName = data.room || "Lobby";
                
                // 1. Masukkan Player ke Room
                if (!rooms[roomName]) rooms[roomName] = [];
                rooms[roomName].push(ws);
                ws.room = roomName;

                // 2. Hitung Seed dari Nama Room (String to Integer Hash)
                const seed = generateSeed(roomName);

                // 3. Kirim Seed & Info ke Player
                ws.send(JSON.stringify({
                    type: 'WELCOME',
                    seed: seed,
                    playerCount: rooms[roomName].length
                }));

                console.log(`Client joined ${roomName} (Seed: ${seed})`);
            }

            // --- TIPE 2: UPDATE POSISI/AKSI ---
            // Server cuma jadi "Pantulan" (Relay)
            // Player A kirim posisi -> Server sebar ke Player B, C, D
            if (data.type === 'UPDATE' && ws.room) {
                broadcastToRoom(ws.room, message, ws); // ws dikirim agar tidak memantul ke pengirim
            }

        } catch (e) {
            console.error("Invalid Json:", e);
        }
    });

    ws.on('close', () => {
        if (ws.room && rooms[ws.room]) {
            // Hapus player dari room
            rooms[ws.room] = rooms[ws.room].filter(client => client !== ws);
            if (rooms[ws.room].length === 0) delete rooms[ws.room];
        }
    });
});

// Fungsi Broadcast (Kirim ke semua kecuali pengirim)
function broadcastToRoom(roomName, msgData, senderWs) {
    if (!rooms[roomName]) return;
    rooms[roomName].forEach(client => {
        if (client !== senderWs && client.readyState === WebSocket.OPEN) {
            client.send(msgData);
        }
    });
}

// Fungsi Hash String jadi Angka (Java String.hashCode() equivalent)
function generateSeed(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash); // Kita butuh positif buat Seed
}
