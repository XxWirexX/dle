import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';

export default function useSocket(token = null) {
  const socketRef = useRef(null);
  const tokenRef = useRef(token);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);

  // Mettre à jour la ref du token dans un effet
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  // État du matchmaking
  const [inQueue, setInQueue] = useState(false);
  const [queuePosition, setQueuePosition] = useState(0);

  // État de la partie
  const [roomId, setRoomId] = useState(null);
  const [isYourTurn, setIsYourTurn] = useState(false);
  const [opponentId, setOpponentId] = useState(null);
  const [gameData, setGameData] = useState(null);

  // État des tentatives
  const [myAttempts, setMyAttempts] = useState([]);
  const [opponentAttempts, setOpponentAttempts] = useState([]);

  // État de fin de partie
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState(null);
  const [target, setTarget] = useState(null);
  const [rematchRequested, setRematchRequested] = useState(false);
  const [opponentWantsRematch, setOpponentWantsRematch] = useState(false);

  // État adversaire
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);
  const [opponentLeft, setOpponentLeft] = useState(false);

  // Socket ID comme état
  const [socketId, setSocketId] = useState(null);

  // Connexion au serveur
  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    const options = {
      transports: ['websocket', 'polling'],
      auth: {}
    };

    // Ajouter le token si disponible
    if (tokenRef.current) {
      options.auth.token = tokenRef.current;
    }

    socketRef.current = io(SOCKET_URL, options);

    socketRef.current.on('connect', () => {
      setIsConnected(true);
      setConnectionError(null);
      setSocketId(socketRef.current?.id || null);
      console.log('Connected to server');
    });

    socketRef.current.on('disconnect', () => {
      setIsConnected(false);
      setSocketId(null);
      console.log('Disconnected from server');
    });

    socketRef.current.on('connect_error', (error) => {
      setConnectionError(error.message);
      console.error('Connection error:', error);
    });

    // Matchmaking events
    socketRef.current.on('queue-joined', ({ position }) => {
      setInQueue(true);
      setQueuePosition(position);
    });

    socketRef.current.on('queue-left', () => {
      setInQueue(false);
      setQueuePosition(0);
    });

    socketRef.current.on('match-found', ({ roomId, isYourTurn, opponentId, gameData }) => {
      setInQueue(false);
      setRoomId(roomId);
      setIsYourTurn(isYourTurn);
      setOpponentId(opponentId);
      setGameData(gameData);
      setMyAttempts([]);
      setOpponentAttempts([]);
      setGameOver(false);
      setWinner(null);
      setTarget(null);
      setRematchRequested(false);
      setOpponentWantsRematch(false);
      setOpponentDisconnected(false);
      setOpponentLeft(false);
    });

    // Game events
    socketRef.current.on('guess-result', ({ attempt, isCorrect, isYourTurn }) => {
      setMyAttempts(prev => [attempt, ...prev]);
      if (!isCorrect) {
        setIsYourTurn(isYourTurn);
      }
    });

    socketRef.current.on('guess-error', ({ error }) => {
      console.error('Guess error:', error);
    });

    socketRef.current.on('opponent-guess', ({ attempt, isYourTurn }) => {
      setOpponentAttempts(prev => [attempt, ...prev]);
      setIsYourTurn(isYourTurn);
    });

    socketRef.current.on('game-over', ({ target, winnerId }) => {
      setGameOver(true);
      setWinner(winnerId);
      setTarget(target);
    });

    // Rematch events
    socketRef.current.on('rematch-requested', () => {
      setOpponentWantsRematch(true);
    });

    socketRef.current.on('rematch-vote-registered', () => {
      setRematchRequested(true);
    });

    socketRef.current.on('rematch-starting', ({ isYourTurn }) => {
      setMyAttempts([]);
      setOpponentAttempts([]);
      setGameOver(false);
      setWinner(null);
      setTarget(null);
      setIsYourTurn(isYourTurn);
      setRematchRequested(false);
      setOpponentWantsRematch(false);
    });

    // Opponent events
    socketRef.current.on('opponent-disconnected', () => {
      setOpponentDisconnected(true);
    });

    socketRef.current.on('opponent-left', () => {
      setOpponentLeft(true);
    });

    socketRef.current.on('room-left', () => {
      setRoomId(null);
      setIsYourTurn(false);
      setOpponentId(null);
      setGameData(null);
      setMyAttempts([]);
      setOpponentAttempts([]);
      setGameOver(false);
      setWinner(null);
      setTarget(null);
    });
  }, []);

  // Déconnexion du serveur
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      setInQueue(false);
      setRoomId(null);
    }
  }, []);

  // Actions
  const joinQueue = useCallback((animeId, gameData) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('join-queue', { animeId, gameData });
    }
  }, []);

  const leaveQueue = useCallback((animeId) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('leave-queue', { animeId });
    }
  }, []);

  const makeGuess = useCallback((character) => {
    if (socketRef.current?.connected && roomId) {
      socketRef.current.emit('make-guess', { roomId, character });
    }
  }, [roomId]);

  const requestRematch = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('request-rematch');
    }
  }, []);

  const leaveRoom = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('leave-room');
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    // Connection
    connect,
    disconnect,
    isConnected,
    connectionError,
    socketId,

    // Queue
    joinQueue,
    leaveQueue,
    inQueue,
    queuePosition,

    // Room/Game
    roomId,
    isYourTurn,
    opponentId,
    gameData,
    makeGuess,

    // Attempts
    myAttempts,
    opponentAttempts,

    // Game over
    gameOver,
    winner,
    target,

    // Rematch
    requestRematch,
    rematchRequested,
    opponentWantsRematch,

    // Opponent status
    opponentDisconnected,
    opponentLeft,
    leaveRoom
  };
}
