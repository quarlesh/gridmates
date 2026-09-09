export type Direction = "ACROSS" | "DOWN";

export type MultiplayerPlayer = {
  id: string;
  name: string;
  color: number;
  selected: string;
  direction: Direction;
};

export type MultiplayerMessage =
  | { type: "JOIN"; roomId: string; name: string }
  | { type: "CELL_UPDATED"; cellId: string; value: string | null }
  | { type: "CELL_SELECTED"; cellId: string; direction: Direction }
  | { type: "BOARD_RESET" };

export type ServerMessage =
  | {
      type: "CONNECTED";
      playerId: string;
      state: {
        values: Record<string, string>;
        players: MultiplayerPlayer[];
        completed: boolean;
      };
    }
  | { type: "PLAYER_JOINED"; player: MultiplayerPlayer }
  | { type: "PLAYER_LEFT"; playerId: string }
  | { type: "CELL_UPDATED"; cellId: string; value: string | null; playerId: string }
  | { type: "CELL_SELECTED"; playerId: string; cellId: string; direction: Direction }
  | { type: "GAME_COMPLETED" }
  | { type: "BOARD_RESET"; playerId: string }
  | { type: "ERROR"; message: string };
