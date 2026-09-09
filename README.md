# Grid Mates

A Next.js/TypeScript crossword UI that reads the supplied `.puz` file server-side and renders an interactive crossword.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000/game/demo

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

## Next multiplayer step

The current `GameState` is intentionally local to the browser. The next layer should add a WebSocket server with events such as:

- `PLAYER_JOINED`
- `PLAYER_LEFT`
- `CELL_UPDATED`
- `CELL_SELECTED`
- `GAME_COMPLETED`

The server should own the shared board state and validate completion against the parsed puzzle solution.
