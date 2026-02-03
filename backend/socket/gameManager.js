const { getFeedbackObject } = require('./feedbackUtils');

class GameManager {
  constructor() {
    // Queue par anime: Map<animeId, Socket[]>
    this.matchmakingQueues = new Map();
    // Rooms de jeu: Map<roomId, GameRoom>
    this.gameRooms = new Map();
    // Map socket -> roomId pour retrouver la room d'un joueur
    this.playerRooms = new Map();
  }

  // Génère un ID unique pour une room
  generateRoomId() {
    return `room_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  // Sélection aléatoire d'une cible
  pickTarget(characters) {
    const i = Math.floor(Math.random() * characters.length);
    return characters[i];
  }

  // Ajouter un joueur à la queue
  joinQueue(socket, animeId, gameData) {
    if (!this.matchmakingQueues.has(animeId)) {
      this.matchmakingQueues.set(animeId, []);
    }

    const queue = this.matchmakingQueues.get(animeId);

    // Vérifier si le joueur est déjà dans une queue
    const existingIndex = queue.findIndex(item => item.socket.id === socket.id);
    if (existingIndex !== -1) {
      return { status: 'already-in-queue', position: existingIndex + 1 };
    }

    queue.push({ socket, gameData });
    const position = queue.length;

    // Si on a 2 joueurs, créer une room
    if (queue.length >= 2) {
      const player1 = queue.shift();
      const player2 = queue.shift();
      return this.createRoom(player1, player2, animeId);
    }

    return { status: 'queue-joined', position };
  }

  // Retirer un joueur de la queue
  leaveQueue(socket, animeId) {
    if (!this.matchmakingQueues.has(animeId)) return;

    const queue = this.matchmakingQueues.get(animeId);
    const index = queue.findIndex(item => item.socket.id === socket.id);
    if (index !== -1) {
      queue.splice(index, 1);
    }
  }

  // Retirer un joueur de toutes les queues
  leaveAllQueues(socket) {
    for (const [animeId, queue] of this.matchmakingQueues) {
      const index = queue.findIndex(item => item.socket.id === socket.id);
      if (index !== -1) {
        queue.splice(index, 1);
      }
    }
  }

  // Créer une room de jeu
  createRoom(player1, player2, animeId) {
    const roomId = this.generateRoomId();
    const gameData = player1.gameData;
    const characters = gameData.characters || [];
    const target = this.pickTarget(characters);

    // Choisir aléatoirement qui commence
    const firstPlayer = Math.random() < 0.5 ? player1.socket.id : player2.socket.id;

    const room = {
      id: roomId,
      animeId,
      target,
      gameData,
      players: {
        [player1.socket.id]: {
          attempts: [],
          rematchVote: false,
          username: `Joueur 1`
        },
        [player2.socket.id]: {
          attempts: [],
          rematchVote: false,
          username: `Joueur 2`
        }
      },
      currentTurn: firstPlayer,
      status: 'playing',
      winner: null,
      createdAt: Date.now()
    };

    this.gameRooms.set(roomId, room);
    this.playerRooms.set(player1.socket.id, roomId);
    this.playerRooms.set(player2.socket.id, roomId);

    return {
      status: 'match-found',
      roomId,
      room,
      players: [player1.socket, player2.socket]
    };
  }

  // Obtenir la room d'un joueur
  getPlayerRoom(socketId) {
    const roomId = this.playerRooms.get(socketId);
    if (!roomId) return null;
    return this.gameRooms.get(roomId);
  }

  // Obtenir l'ID de l'adversaire
  getOpponentId(room, socketId) {
    const playerIds = Object.keys(room.players);
    return playerIds.find(id => id !== socketId);
  }

  // Traiter un guess
  makeGuess(socket, roomId, character) {
    const room = this.gameRooms.get(roomId);
    if (!room) {
      return { error: 'Room introuvable' };
    }

    if (room.status !== 'playing') {
      return { error: 'La partie est terminée' };
    }

    if (room.currentTurn !== socket.id) {
      return { error: "Ce n'est pas ton tour" };
    }

    const player = room.players[socket.id];
    if (!player) {
      return { error: 'Joueur introuvable dans la room' };
    }

    // Vérifier si le personnage a déjà été essayé (par moi ou l'adversaire)
    const allAttempts = Object.values(room.players).flatMap(p => p.attempts);
    if (allAttempts.some(a => a.guess.id === character.id)) {
      return { error: 'Ce personnage a déjà été joué' };
    }

    // Calculer le feedback
    const feedback = getFeedbackObject(character, room.target, room.gameData.attributes || []);
    const isCorrect = character.id === room.target.id;

    const attempt = { guess: character, feedback, isCorrect, timestamp: Date.now() };
    player.attempts.push(attempt);

    // Vérifier si la partie est terminée
    if (isCorrect) {
      room.status = 'finished';
      room.winner = socket.id;
      return {
        status: 'game-over',
        attempt,
        winner: socket.id,
        target: room.target
      };
    }

    // Changer de tour
    const opponentId = this.getOpponentId(room, socket.id);
    room.currentTurn = opponentId;

    return {
      status: 'guess-made',
      attempt,
      nextTurn: opponentId
    };
  }

  // Demander une revanche
  requestRematch(socket) {
    const room = this.getPlayerRoom(socket.id);
    if (!room) {
      return { error: 'Room introuvable' };
    }

    if (room.status !== 'finished') {
      return { error: 'La partie n\'est pas terminée' };
    }

    const player = room.players[socket.id];
    if (!player) {
      return { error: 'Joueur introuvable' };
    }

    player.rematchVote = true;

    // Vérifier si les deux joueurs veulent une revanche
    const playerIds = Object.keys(room.players);
    const allVoted = playerIds.every(id => room.players[id].rematchVote);

    if (allVoted) {
      // Reset la room pour une nouvelle partie
      const newTarget = this.pickTarget(room.gameData.characters || []);
      room.target = newTarget;
      room.status = 'playing';
      room.winner = null;

      // Choisir aléatoirement qui commence
      room.currentTurn = playerIds[Math.floor(Math.random() * 2)];

      // Reset les joueurs
      playerIds.forEach(id => {
        room.players[id].attempts = [];
        room.players[id].rematchVote = false;
      });

      return {
        status: 'rematch-starting',
        room
      };
    }

    return {
      status: 'rematch-requested',
      votedBy: socket.id
    };
  }

  // Quitter une room
  leaveRoom(socket) {
    const roomId = this.playerRooms.get(socket.id);
    if (!roomId) return null;

    const room = this.gameRooms.get(roomId);
    if (!room) {
      this.playerRooms.delete(socket.id);
      return null;
    }

    const opponentId = this.getOpponentId(room, socket.id);

    // Supprimer la room
    this.gameRooms.delete(roomId);
    this.playerRooms.delete(socket.id);
    if (opponentId) {
      this.playerRooms.delete(opponentId);
    }

    return { opponentId, roomId };
  }

  // Nettoyer quand un joueur se déconnecte
  handleDisconnect(socket) {
    this.leaveAllQueues(socket);
    return this.leaveRoom(socket);
  }
}

module.exports = GameManager;
