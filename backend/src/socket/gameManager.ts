// @ts-nocheck
import { getFeedbackObject } from './feedbackUtils';

class GameManager {
  private matchmakingQueues: Map<string, any[]>;
  private gameRooms: Map<string, any>;
  private playerRooms: Map<string, string>;
  private userSockets: Map<string, string>;

  constructor() {
    // Queue par anime: Map<animeId, Socket[]>
    this.matchmakingQueues = new Map();
    // Rooms de jeu: Map<roomId, GameRoom>
    this.gameRooms = new Map();
    // Map socket -> roomId pour retrouver la room d'un joueur
    this.playerRooms = new Map();
    // Map userId -> socketId pour empêcher les connexions multiples
    this.userSockets = new Map();
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

  // Vérifier si un utilisateur est déjà en jeu ou en queue
  isUserBusy(userId) {
    if (!userId) return false;

    // Vérifier si l'utilisateur a déjà un socket actif
    const existingSocketId = this.userSockets.get(userId);
    if (existingSocketId) {
      // Vérifier s'il est dans une room
      if (this.playerRooms.has(existingSocketId)) {
        return { busy: true, reason: 'already-in-game' };
      }
      // Vérifier s'il est dans une queue
      for (const [, queue] of this.matchmakingQueues) {
        if (queue.some(item => item.user?.userId === userId)) {
          return { busy: true, reason: 'already-in-queue' };
        }
      }
    }
    return { busy: false };
  }

  // Ajouter un joueur à la queue
  joinQueue(socket, animeId, gameData, user = null, difficulty = null) {
    // Vérifier si l'utilisateur connecté est déjà occupé
    if (user?.userId) {
      const busyCheck = this.isUserBusy(user.userId);
      if (busyCheck.busy) {
        return { status: busyCheck.reason };
      }
      // Enregistrer ce socket pour cet utilisateur
      this.userSockets.set(user.userId, socket.id);
    }

    if (!this.matchmakingQueues.has(animeId)) {
      this.matchmakingQueues.set(animeId, []);
    }

    const queue = this.matchmakingQueues.get(animeId);

    // Vérifier si le joueur est déjà dans une queue (par socket.id)
    const existingIndex = queue.findIndex(item => item.socket.id === socket.id);
    if (existingIndex !== -1) {
      return { status: 'already-in-queue', position: existingIndex + 1 };
    }

    queue.push({ socket, gameData, user, difficulty });
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
      const player = queue[index];
      // Nettoyer le tracking utilisateur
      if (player.user?.userId) {
        this.userSockets.delete(player.user.userId);
      }
      queue.splice(index, 1);
    }
  }

  // Retirer un joueur de toutes les queues
  leaveAllQueues(socket) {
    for (const [, queue] of this.matchmakingQueues) {
      const index = queue.findIndex(item => item.socket.id === socket.id);
      if (index !== -1) {
        const player = queue[index];
        // Nettoyer le tracking utilisateur
        if (player.user?.userId) {
          this.userSockets.delete(player.user.userId);
        }
        queue.splice(index, 1);
      }
    }
  }

  // Créer une room de jeu
  createRoom(player1, player2, animeId) {
    const roomId = this.generateRoomId();
    const gameData = player1.gameData;
    let characters = gameData.characters || [];

    // Helper to get difficulty level (facile=1, moyen=2, difficile=3)
    const getDifficultyLevel = (diff) => {
      const levels = { facile: 1, moyen: 2, difficile: 3 };
      return levels[diff?.toLowerCase()] || 0;
    };

    // Filtrer par difficulté si spécifiée (inclusive - includes lower difficulties)
    const difficulty1 = player1.difficulty;
    const difficulty2 = player2.difficulty;

    if (difficulty1 || difficulty2) {
      // Get the max difficulty level selected (most restrictive filter)
      const level1 = getDifficultyLevel(difficulty1);
      const level2 = getDifficultyLevel(difficulty2);
      const maxLevel = Math.max(level1, level2);

      if (maxLevel > 0) {
        characters = characters.filter(c => getDifficultyLevel(c.difficulty) <= maxLevel);
      }
    }

    const target = this.pickTarget(characters);

    // Choisir aléatoirement qui commence
    const firstPlayer = Math.random() < 0.5 ? player1.socket.id : player2.socket.id;

    // Utiliser le username de l'utilisateur connecté ou un nom par défaut
    const username1 = player1.user?.username || 'Joueur 1';
    const username2 = player2.user?.username || 'Joueur 2';

    const room = {
      id: roomId,
      animeId,
      target,
      gameData: { ...gameData, characters },
      players: {
        [player1.socket.id]: {
          attempts: [],
          rematchVote: false,
          username: username1,
          user: player1.user
        },
        [player2.socket.id]: {
          attempts: [],
          rematchVote: false,
          username: username2,
          user: player2.user
        }
      },
      sessionScores: {
        [player1.socket.id]: 0,
        [player2.socket.id]: 0
      },
      messages: [],
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

  // Ajouter un message au chat de la room
  addMessage(socketId, text) {
    const room = this.getPlayerRoom(socketId);
    if (!room) return null;

    const player = room.players[socketId];
    if (!player) return null;

    const message = {
      id: Date.now(),
      senderId: socketId,
      senderName: player.username,
      text: text.substring(0, 200), // Limite 200 caractères
      timestamp: Date.now()
    };

    room.messages.push(message);

    // Garder seulement les 50 derniers messages
    if (room.messages.length > 50) {
      room.messages.shift();
    }

    return { message, roomId: room.id };
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
      room.sessionScores[socket.id]++;
      return {
        status: 'game-over',
        attempt,
        winner: socket.id,
        target: room.target,
        sessionScores: room.sessionScores
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

    // Nettoyer le tracking utilisateur SEULEMENT pour le joueur qui part
    const leavingPlayer = room.players[socket.id];
    if (leavingPlayer?.user?.userId) {
      this.userSockets.delete(leavingPlayer.user.userId);
    }

    // Supprimer la room et nettoyer les deux joueurs de playerRooms
    this.gameRooms.delete(roomId);
    this.playerRooms.delete(socket.id);
    if (opponentId) {
      this.playerRooms.delete(opponentId);
      // Nettoyer aussi le tracking de l'adversaire car la room n'existe plus
      const opponentPlayer = room.players[opponentId];
      if (opponentPlayer?.user?.userId) {
        this.userSockets.delete(opponentPlayer.user.userId);
      }
    }

    return { opponentId, roomId };
  }

  // Nettoyer quand un joueur se déconnecte
  handleDisconnect(socket) {
    this.leaveAllQueues(socket);
    return this.leaveRoom(socket);
  }
}

export default GameManager;
