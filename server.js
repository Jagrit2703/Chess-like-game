const WebSocket = require('ws');
const express = require('express');
const http = require('http');

const app = express();
const server = http.createServer(app);

app.use(express.static('public'));

const wss = new WebSocket.Server({ server });

let gameState = initializeGameState();

function initializeGameState() {
    return {
        board: Array(5).fill(null).map(() => Array(5).fill(null)),
        players: {
            A: initializePlayer(),
            B: initializePlayer(),
        },
        turn: 'A',
        moveHistory: []
    };
}

function initializePlayer() {
    return [
        { type: 'P1', x: 0, y: 0 },
        { type: 'P2', x: 1, y: 0 },
        { type: 'H1', x: 2, y: 0 },
        { type: 'P3', x: 3, y: 0 },
        { type: 'H2', x: 4, y: 0 }
    ];
}

// Initialize players' positions
function initializeGame() {
    gameState.players['A'] = [
        { type: 'P', x: 0, y: 0 },
        { type: 'H1', x: 1, y: 0 },
        { type: 'H2', x: 2, y: 0 },
        { type: 'P', x: 3, y: 0 },
        { type: 'P', x: 4, y: 0 }
    ];

    gameState.players['B'] = [
        { type: 'P', x: 0, y: 4 },
        { type: 'H1', x: 1, y: 4 },
        { type: 'H2', x: 2, y: 4 },
        { type: 'P', x: 3, y: 4 },
        { type: 'P', x: 4, y: 4 }
    ];
    
    updateBoard();
}


function processMove(player, move) {
    let [char, direction] = move.split(':');
    let character = gameState.players[player].find(c => `${player}-${c.type}` === char);

    if (!character) return false;

    let [dx, dy] = [0, 0];
    switch (direction) {
        case 'L': dx = -1; break;
        case 'R': dx = 1; break;
        case 'F': dy = -1; break;
        case 'B': dy = 1; break;
        case 'FL': dx = -1; dy = -1; break;
        case 'FR': dx = 1; dy = -1; break;
        case 'BL': dx = -1; dy = 1; break;
        case 'BR': dx = 1; dy = 1; break;
    }

    let newX = character.x + dx;
    let newY = character.y + dy;

    if (newX < 0 || newX >= 5 || newY < 0 || newY >= 5) return false;

    let opponent = gameState.board[newY][newX];
    if (opponent && opponent.startsWith(player)) return false;

    character.x = newX;
    character.y = newY;

    gameState.moveHistory.push(`${player} - ${char}:${direction}`);

    if (opponent) {
        let [opponentPlayer, opponentType] = opponent.split('-');
        gameState.players[opponentPlayer] = gameState.players[opponentPlayer].filter(c => c.type !== opponentType);
    }

    updateBoard();
    gameState.turn = gameState.turn === 'A' ? 'B' : 'A';
    return true;
}

function updateBoard() {
    gameState.board = Array(5).fill(null).map(() => Array(5).fill(null));
    for (const player of ['A', 'B']) {
        gameState.players[player].forEach(character => {
            gameState.board[character.y][character.x] = `${player}-${character.type}`;
        });
    }
}

// Handle WebSocket connections
wss.on('connection', ws => {
    ws.send(JSON.stringify({ type: 'init', state: gameState }));

    ws.on('message', message => {
        const msg = JSON.parse(message);

        if (msg.type === 'move') {
            if (gameState.turn !== msg.player) {
                ws.send(JSON.stringify({ type: 'invalid' }));
                return;
            }

            if (processMove(msg.player, msg.move)) {
                broadcastGameState();

                // Check if the game is over
                if (isGameOver()) {
                    const winner = gameState.turn === 'A' ? 'B' : 'A';
                    broadcastMessage({ type: 'gameOver', winner: winner });
                    gameState = initializeGameState(); // Reset the game state
                }
            } else {
                ws.send(JSON.stringify({ type: 'invalid' }));
            }
        }
    });
});

function isGameOver() {
    return gameState.players['A'].length === 0 || gameState.players['B'].length === 0;
}

// Broadcast to all connected clients
function broadcastGameState() {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'update', state: gameState }));
        }
    });
}

// Initialize game state
initializeGame();

// Start the server
server.listen(8080, () => {
    console.log('Server is running on http://localhost:8080');
});
