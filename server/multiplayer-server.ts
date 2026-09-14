import { randomUUID } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";
import { loadPuzzle } from "../lib/puzzle/load-puzzle";
import type {
  MultiplayerMessage,
  MultiplayerPlayer,
} from "../lib/multiplayer/protocol";

type Puzzle = Awaited<ReturnType<typeof loadPuzzle>>;

type Client = {
  socket: WebSocket;
  player: MultiplayerPlayer;
};

type Room = {
  id: string;
  values: Record<string, string>;
  clients: Map<string, Client>;
};

const PORT = Number(process.env.PORT ?? 3001);
const MAX_PLAYERS = 4;

const PLAYER_COLORS = [0, 1, 2, 3] as const;

const puzzlePromise = loadPuzzle();
const rooms = new Map<string, Room>();

/**
 * ---------------------------------------------------------------------------
 * Room helpers
 * ---------------------------------------------------------------------------
 */

function getRoom(roomId: string): Room {
  const existingRoom = rooms.get(roomId);

  if (existingRoom) {
    return existingRoom;
  }

  const room: Room = {
    id: roomId,
    values: {},
    clients: new Map(),
  };

  rooms.set(roomId, room);

  return room;
}

function isRoomFull(room: Room): boolean {
  return room.clients.size >= MAX_PLAYERS;
}

function getPlayers(room: Room): MultiplayerPlayer[] {
  return [...room.clients.values()].map((client) => client.player);
}

function getAvailableColor(room: Room): number | undefined {
  const usedColors = new Set(
    [...room.clients.values()].map((client) => client.player.color),
  );

  return PLAYER_COLORS.find((color) => !usedColors.has(color));
}

function removeClient(room: Room, clientId: string): void {
  room.clients.delete(clientId);

  if (room.clients.size === 0) {
    rooms.delete(room.id);
  }
}

/**
 * ---------------------------------------------------------------------------
 * WebSocket helpers
 * ---------------------------------------------------------------------------
 */

function send(socket: WebSocket, message: unknown): void {
  if (socket.readyState !== WebSocket.OPEN) {
    return;
  }

  socket.send(JSON.stringify(message));
}

function broadcast(
  room: Room,
  message: unknown,
  except?: WebSocket,
): void {
  for (const client of room.clients.values()) {
    if (client.socket === except) {
      continue;
    }

    send(client.socket, message);
  }
}

/**
 * ---------------------------------------------------------------------------
 * Puzzle helpers
 * ---------------------------------------------------------------------------
 */

function isValidCell(puzzle: Puzzle, cellId: string): boolean {
  const cell = puzzle.cells.find(
    (candidate) =>
      `${candidate.row}-${candidate.column}` === cellId,
  );

  return Boolean(cell && !cell.isBlock);
}

function isSolved(
  puzzle: Puzzle,
  values: Record<string, string>,
): boolean {
  return puzzle.cells
    .filter((cell) => !cell.isBlock)
    .every(
      (cell) =>
        values[`${cell.row}-${cell.column}`] === cell.answer,
    );
}

/**
 * ---------------------------------------------------------------------------
 * JOIN
 * ---------------------------------------------------------------------------
 */

function handleJoin(
  socket: WebSocket,
  message: Extract<MultiplayerMessage, { type: "JOIN" }>,
  puzzle: Puzzle,
): { room: Room; clientId: string } | undefined {
  const room = getRoom(message.roomId);

  if (isRoomFull(room)) {
    send(socket, {
      type: "ERROR",
      message: "Room is full",
    });

    socket.close(4001, "Room Full");

    return;
  }

  const color = getAvailableColor(room);

  if (color === undefined) {
    send(socket, {
      type: "ERROR",
      message: "Room is full",
    });

    socket.close(4001, "Room Full");

    return;
  }

  const clientId = randomUUID();

  const player: MultiplayerPlayer = {
    id: clientId,
    name: message.name.slice(0, 24) || "Player",
    color,
    selected: "0-0",
    direction: "ACROSS",
  };

  room.clients.set(clientId, {
    socket,
    player,
  });

  send(socket, {
    type: "CONNECTED",
    playerId: clientId,
    state: {
      values: room.values,
      players: getPlayers(room),
      completed: isSolved(puzzle, room.values),
    },
  });

  broadcast(
    room,
    {
      type: "PLAYER_JOINED",
      player,
    },
    socket,
  );

  return {
    room,
    clientId,
  };
}

/**
 * ---------------------------------------------------------------------------
 * CELL_UPDATED
 * ---------------------------------------------------------------------------
 */

function handleCellUpdated(
  room: Room,
  clientId: string,
  message: Extract<
    MultiplayerMessage,
    { type: "CELL_UPDATED" }
  >,
  puzzle: Puzzle,
): void {
  if (!isValidCell(puzzle, message.cellId)) {
    return;
  }

  if (message.value === null) {
    delete room.values[message.cellId];
  } else if (/^[A-Z]$/.test(message.value)) {
    room.values[message.cellId] = message.value;
  } else {
    return;
  }

  broadcast(room, {
    type: "CELL_UPDATED",
    cellId: message.cellId,
    value: room.values[message.cellId] ?? null,
    playerId: clientId,
  });

  if (isSolved(puzzle, room.values)) {
    broadcast(room, {
      type: "GAME_COMPLETED",
    });
  }
}

/**
 * ---------------------------------------------------------------------------
 * CELL_SELECTED
 * ---------------------------------------------------------------------------
 */

function handleCellSelected(
  socket: WebSocket,
  room: Room,
  clientId: string,
  message: Extract<
    MultiplayerMessage,
    { type: "CELL_SELECTED" }
  >,
  puzzle: Puzzle,
): void {
  if (!isValidCell(puzzle, message.cellId)) {
    return;
  }

  if (
    message.direction !== "ACROSS" &&
    message.direction !== "DOWN"
  ) {
    return;
  }

  const client = room.clients.get(clientId);

  if (!client) {
    return;
  }

  client.player.selected = message.cellId;
  client.player.direction = message.direction;

  broadcast(
    room,
    {
      type: "CELL_SELECTED",
      playerId: clientId,
      cellId: message.cellId,
      direction: message.direction,
    },
    socket,
  );
}

/**
 * ---------------------------------------------------------------------------
 * BOARD_RESET
 * ---------------------------------------------------------------------------
 */

function handleBoardReset(
  room: Room,
  clientId: string,
): void {
  room.values = {};

  for (const client of room.clients.values()) {
    client.player.selected = "0-0";
    client.player.direction = "ACROSS";
  }

  broadcast(room, {
    type: "BOARD_RESET",
    playerId: clientId,
  });
}

/**
 * ---------------------------------------------------------------------------
 * MESSAGE DISPATCH
 * ---------------------------------------------------------------------------
 */

function handleMessage(
  socket: WebSocket,
  room: Room,
  clientId: string,
  message: MultiplayerMessage,
  puzzle: Puzzle,
): void {
  switch (message.type) {
    case "CELL_UPDATED":
      handleCellUpdated(
        room,
        clientId,
        message,
        puzzle,
      );
      break;

    case "CELL_SELECTED":
      handleCellSelected(
        socket,
        room,
        clientId,
        message,
        puzzle,
      );
      break;

    case "BOARD_RESET":
      handleBoardReset(room, clientId);
      break;

    default:
      break;
  }
}

/**
 * ---------------------------------------------------------------------------
 * WebSocket server
 * ---------------------------------------------------------------------------
 */

const wss = new WebSocketServer({
  port: PORT,
});

wss.on("connection", (socket) => {
  let room: Room | undefined;
  let clientId: string | undefined;

  socket.on("message", async (raw) => {
    try {
      const message = JSON.parse(
        raw.toString(),
      ) as MultiplayerMessage;

      const puzzle = await puzzlePromise;

      /**
       * JOIN is the only message allowed before a client
       * has joined a room.
       */
      if (message.type === "JOIN") {
        if (room) {
          return;
        }

        const result = handleJoin(
          socket,
          message,
          puzzle,
        );

        if (!result) {
          return;
        }

        room = result.room;
        clientId = result.clientId;

        return;
      }

      /**
       * All other messages require an active room/client.
       */
      if (!room || !clientId) {
        send(socket, {
          type: "ERROR",
          message: "Join a room first.",
        });

        return;
      }

      handleMessage(
        socket,
        room,
        clientId,
        message,
        puzzle,
      );
    } catch (error) {
      console.error(
        "WebSocket message error:",
        error,
      );

      send(socket, {
        type: "ERROR",
        message: "Invalid message.",
      });
    }
  });

  socket.on("close", () => {
    if (!room || !clientId) {
      return;
    }

    removeClient(room, clientId);

    broadcast(room, {
      type: "PLAYER_LEFT",
      playerId: clientId,
    });
  });
});

console.log(
  `Grid Mates WebSocket server listening on ws://localhost:${PORT}`,
);
