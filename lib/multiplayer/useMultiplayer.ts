import { useEffect, useMemo, useRef, useState } from "react";
import type { Direction } from "./protocol";
import type { MultiplayerPlayer, MultiplayerMessage, ServerMessage } from "./protocol";

type Options = {
  roomId: string;
  name?: string;
};

const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ??
  (typeof window !== "undefined"
    ? `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.hostname}:3001`
    : "");

function makeName() {
  if (typeof window === "undefined") return "Player";
  const stored = window.localStorage.getItem("gridmates-player-name");
  if (stored) return stored;
  const name = `Player ${Math.floor(Math.random() * 900 + 100)}`;
  window.localStorage.setItem("gridmates-player-name", name);
  return name;
}

export function useMultiplayer({ roomId, name }: Options) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [players, setPlayers] = useState<MultiplayerPlayer[]>([]);
  const [completed, setCompleted] = useState(false);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const playerIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!WS_URL) return;

    const socket = new WebSocket(WS_URL);
    socketRef.current = socket;

    socket.onopen = () => {
      setConnected(true);
      const message: MultiplayerMessage = {
        type: "JOIN",
        roomId,
        name: name?.trim() || makeName(),
      };
      socket.send(JSON.stringify(message));
    };

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data) as ServerMessage;

      switch (message.type) {
        case "CONNECTED":
          playerIdRef.current = message.playerId;
          setValues(message.state.values);
          setPlayers(message.state.players);
          setCompleted(message.state.completed);
          break;
        case "PLAYER_JOINED":
          setPlayers((current) => [
            ...current.filter((player) => player.id !== message.player.id),
            message.player,
          ]);
          break;
        case "PLAYER_LEFT":
          setPlayers((current) =>
            current.filter((player) => player.id !== message.playerId),
          );
          break;
        case "CELL_UPDATED":
          setValues((current) => {
            const next = { ...current };
            if (message.value) next[message.cellId] = message.value;
            else delete next[message.cellId];
            return next;
          });
          break;
        case "CELL_SELECTED":
          setPlayers((current) =>
            current.map((player) =>
              player.id === message.playerId
                ? {
                    ...player,
                    selected: message.cellId,
                    direction: message.direction,
                  }
                : player,
            ),
          );
          break;
        case "GAME_COMPLETED":
          setCompleted(true);
          break;
        case "BOARD_RESET":
          setValues({});
          setCompleted(false);
          break;
        case "ERROR":
          console.error(message.message);
          break;
      }
    };

    socket.onclose = () => setConnected(false);
    socket.onerror = () => setConnected(false);

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [roomId, name]);

  const send = (message: MultiplayerMessage) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  };

  return useMemo(
    () => ({
      values,
      players,
      completed,
      connected,
      playerId: playerIdRef.current,
      updateCell: (cellId: string, value: string | null) =>
        send({ type: "CELL_UPDATED", cellId, value }),
      selectCell: (cellId: string, direction: Direction) =>
        send({ type: "CELL_SELECTED", cellId, direction }),
      resetBoard: () => send({ type: "BOARD_RESET" }),
    }),
    [values, players, completed, connected],
  );
}
