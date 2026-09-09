# Grid Mates

A Next.js/TypeScript crossword UI that reads the supplied `.puz` file server-side and renders an interactive crossword.

## What is included

- Custom `.puz` binary parser (no puzzle-answer data is sent as a static public file)
- Grid and block detection
- Automatic crossword numbering
- Across/Down clue extraction
- Keyboard letter entry
- Backspace/Delete navigation
- Arrow-key navigation
- Active clue and word highlighting
- Error checking toggle
- Completion detection
- The supplied `uc260908.puz` as `puzzles/sample.puz`
- server-authoritative WebSocket multiplayer layer

## Run locally

Install the new dependencies:

```bash
npm install ws
npm install -D @types/ws tsx concurrently
```

Run both servers:

```bash
npm run dev:multiplayer
```

That starts Next.js on `http://localhost:3000` and the WebSocket server on `ws://localhost:3001`.

If the WebSocket server is hosted somewhere else, set:

```bash
NEXT_PUBLIC_WS_URL=wss://your-websocket-host.example.com
```

## Architecture

- The browser owns only presentation/input state.
- The WebSocket server owns each room's shared board.
- Clients send `CELL_UPDATED` and `CELL_SELECTED` intents.
- The server validates cells and letters and broadcasts authoritative updates.
- The server keeps the puzzle solution private and determines completion.
- Joining a room receives the current board plus connected players.
- Disconnects remove the player from the room.
- `BOARD_RESET` clears the shared board for everyone.

The README's requested events are implemented as `PLAYER_JOINED`, `PLAYER_LEFT`, `CELL_UPDATED`, `CELL_SELECTED`, and `GAME_COMPLETED`, with `BOARD_RESET` added for the existing Clear button.

## Production deployment

A long-lived WebSocket process should be deployed separately from a normal serverless Next.js deployment. For example:

- Next.js: Vercel
- WebSocket server: Railway, Render, Fly.io, or another Node host

Set `NEXT_PUBLIC_WS_URL` in the Next.js deployment to the WebSocket service's `wss://...` endpoint.

The room state in this first implementation is intentionally in-memory. For horizontal scaling or durable rooms, move room state into Redis and add pub/sub between WebSocket instances.
