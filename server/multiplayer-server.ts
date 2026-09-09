import { randomUUID } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";
import { loadPuzzle } from "../lib/puzzle/load-puzzle";
import type {
  Direction,
  MultiplayerPlayer,
  MultiplayerMessage,
} from "../lib/multiplayer/protocol";

type Client = {
  socket: WebSocket;
  player: MultiplayerPlayer;
};

type Room = {
  values: Record<string, string>;
  clients: Map<string, Client>;
};

const PORT = Number(process.env.WS_PORT ?? 3001);
const puzzlePromise = loadPuzzle();
const rooms = new Map<string, Room>();

const colors = [0, 1, 2, 3, 4, 5, 6, 7];

function getRoom(roomId: string): Room {
  let room = rooms.get(roomId);
  if (!room) {
    room = { values: {}, clients: new Map() };
    rooms.set(roomId, room);
  }
  return room;
}

function send(socket: WebSocket, message: unknown) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

function broadcast(room: Room, message: unknown, except?: WebSocket) {
  for (const client of room.clients.values()) {
    if (client.socket !== except) send(client.socket, message);
  }
}

function isValidCell(puzzle: Awaited<typeof puzzlePromise>, cellId: string) {
  const cell = puzzle.cells.find(
    (candidate) => `${candidate.row}-${candidate.column}` === cellId,
  );
  return Boolean(cell && !cell.isBlock);
}

function isSolved(
  puzzle: Awaited<typeof puzzlePromise>,
  values: Record<string, string>,
) {
  return puzzle.cells
    .filter((cell) => !cell.isBlock)
    .every(
      (cell) =>
        values[`${cell.row}-${cell.column}`] === cell.answer,
    );
}

const wss = new WebSocketServer({ port: PORT });

wss.on("connection", (socket) => {
  let room: Room | undefined;
  let clientId: string | undefined;

  socket.on("message", async (raw) => {
    try {
      const message = JSON.parse(raw.toString()) as MultiplayerMessage;
      const puzzle = await puzzlePromise;

      if (message.type === "JOIN") {
        if (room) return;

        room = getRoom(message.roomId);
        clientId = randomUUID();

        const usedColors = new Set(
          [...room.clients.values()].map((client) => client.player.color),
        );
        const color =
          colors.find((candidate) => !usedColors.has(candidate)) ??
          colors[room.clients.size % colors.length];
          console.log(color)
        const player: MultiplayerPlayer = {
          id: clientId,
          name: message.name.slice(0, 24) || "Player",
          color,
          selected: "0-0",
          direction: "ACROSS",
        };

        room.clients.set(clientId, { socket, player });

        send(socket, {
          type: "CONNECTED",
          playerId: clientId,
          state: {
            values: room.values,
            players: [...room.clients.values()].map((client) => client.player),
            completed: isSolved(puzzle, room.values),
          },
        });

        broadcast(room, { type: "PLAYER_JOINED", player }, socket);
        return;
      }

      if (!room || !clientId) {
        send(socket, { type: "ERROR", message: "Join a room first." });
        return;
      }

      if (message.type === "CELL_UPDATED") {
        if (!isValidCell(puzzle, message.cellId)) return;

        if (message.value === null) {
          delete room.values[message.cellId];
        } else if (/^[A-Z]$/.test(message.value)) {
          room.values[message.cellId] = message.value;
        } else {
          return;
        }

        broadcast(
          room,
          {
            type: "CELL_UPDATED",
            cellId: message.cellId,
            value: room.values[message.cellId] ?? null,
            playerId: clientId,
          },
        );

        if (isSolved(puzzle, room.values)) {
          broadcast(room, { type: "GAME_COMPLETED" });
        }
        return;
      }

      if (message.type === "CELL_SELECTED") {
        if (!isValidCell(puzzle, message.cellId)) return;
        if (message.direction !== "ACROSS" && message.direction !== "DOWN") {
          return;
        }

        const client = room.clients.get(clientId);
        if (!client) return;

        client.player.selected = message.cellId;
        client.player.direction = message.direction;

        broadcast(room, {
          type: "CELL_SELECTED",
          playerId: clientId,
          cellId: message.cellId,
          direction: message.direction,
        }, socket);
        return;
      }

      if (message.type === "BOARD_RESET") {
        room.values = {};
        for (const client of room.clients.values()) {
          client.player.selected = "0-0";
          client.player.direction = "ACROSS";
        }
        broadcast(room, { type: "BOARD_RESET", playerId: clientId });
      }
    } catch (error) {
      console.error("WebSocket message error", error);
      send(socket, { type: "ERROR", message: "Invalid message." });
    }
  });

  socket.on("close", () => {
    if (!room || !clientId) return;
    room.clients.delete(clientId);
    broadcast(room, { type: "PLAYER_LEFT", playerId: clientId });
    if (room.clients.size === 0) rooms.delete(
      [...rooms.entries()].find(([, candidate]) => candidate === room)?.[0] ?? "",
    );
  });
});

console.log(`Grid Mates WebSocket server listening on ws://localhost:${PORT}`);
