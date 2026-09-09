"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { CrosswordPuzzle, Direction } from "../lib/puzzle/types";
import { useMultiplayer } from "../lib/multiplayer/useMultiplayer";

export default function CrosswordBoard({
  puzzle,
  roomId,
}: {
  puzzle: CrosswordPuzzle;
  roomId: string;
}) {
  const [selected, setSelected] = useState("0-0");
  const [direction, setDirection] = useState<Direction>("ACROSS");
  const [showErrors, setShowErrors] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);

  const {
    values,
    players,
    completed,
    connected,
    playerId,
    updateCell,
    selectCell: syncSelection,
    resetBoard,
  } = useMultiplayer({ roomId });

  useEffect(() => {
    boardRef.current?.focus();
  }, []);

  const selectedCell = puzzle.cells.find(
    (c) => `${c.row}-${c.column}` === selected,
  );

  const activeClue = useMemo(() => {
    if (!selectedCell || selectedCell.isBlock) return undefined;
    return (
      puzzle.clues.find(
        (clue) => clue.direction === direction && clue.cells.includes(selected),
      ) ?? puzzle.clues.find((clue) => clue.cells.includes(selected))
    );
  }, [puzzle.clues, selected, selectedCell, direction]);

  const activeCells = new Set(activeClue?.cells ?? []);
  const solved = completed;
  const filled = Object.keys(values).length;
  const total = puzzle.cells.filter((c) => !c.isBlock).length;
  const remotePlayers = players.filter((player) => player.id !== playerId);

  function selectCell(id: string) {
    const cell = puzzle.cells.find((c) => `${c.row}-${c.column}` === id);
    if (!cell || cell.isBlock) return;

    const nextDirection =
      id === selected
        ? direction === "ACROSS"
          ? "DOWN"
          : "ACROSS"
        : direction;

    setDirection(nextDirection);
    setSelected(id);
    syncSelection(id, nextDirection);

    requestAnimationFrame(() => boardRef.current?.focus());
  }

  function setDirectionAndSync(nextDirection: Direction) {
    setDirection(nextDirection);
    syncSelection(selected, nextDirection);
    requestAnimationFrame(() => boardRef.current?.focus());
  }

  function moveAfterEntry(row: number, column: number) {
    const dr = direction === "DOWN" ? 1 : 0;
    const dc = direction === "ACROSS" ? 1 : 0;
    let r = row + dr;
    let c = column + dc;

    while (r >= 0 && r < puzzle.height && c >= 0 && c < puzzle.width) {
      const cell = puzzle.cells[r * puzzle.width + c];
      if (!cell.isBlock) {
        const id = `${r}-${c}`;
        setSelected(id);
        syncSelection(id, direction);
        return;
      }
      r += dr;
      c += dc;
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!selectedCell || selectedCell.isBlock) return;

    const key = e.key.toUpperCase();

    if (/^[A-Z]$/.test(key)) {
      e.preventDefault();
      const id = `${selectedCell.row}-${selectedCell.column}`;
      updateCell(id, key);
      moveAfterEntry(selectedCell.row, selectedCell.column);
      return;
    }

    if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      const id = `${selectedCell.row}-${selectedCell.column}`;

      if (values[id]) {
        updateCell(id, null);
        return;
      }

      const cluesInDirection = puzzle.clues
        .filter((clue) => clue.direction === direction)
        .sort((a, b) => a.number - b.number);

      const currentClueIndex = cluesInDirection.findIndex((clue) =>
        clue.cells.includes(id),
      );
      if (currentClueIndex === -1) return;

      const currentClue = cluesInDirection[currentClueIndex];
      const currentCellIndex = currentClue.cells.indexOf(id);

      let previousCellId: string | null = null;
      if (currentCellIndex > 0) {
        previousCellId = currentClue.cells[currentCellIndex - 1];
      } else if (currentClueIndex > 0) {
        const previousClue = cluesInDirection[currentClueIndex - 1];
        previousCellId = previousClue.cells[previousClue.cells.length - 1];
      }

      if (previousCellId) {
        setSelected(previousCellId);
        updateCell(previousCellId, null);
        syncSelection(previousCellId, direction);
      }
      return;
    }

    const deltas: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };

    if (deltas[e.key]) {
      e.preventDefault();
      let r = selectedCell.row + deltas[e.key][0];
      let c = selectedCell.column + deltas[e.key][1];

      while (r >= 0 && r < puzzle.height && c >= 0 && c < puzzle.width) {
        const cell = puzzle.cells[r * puzzle.width + c];
        if (!cell.isBlock) {
          const id = `${r}-${c}`;
          setSelected(id);
          syncSelection(id, direction);
          return;
        }
        r += deltas[e.key][0];
        c += deltas[e.key][1];
      }
    }
  }

  function selectClue(clue: (typeof puzzle.clues)[number]) {
    setSelected(clue.cells[0]);
    setDirection(clue.direction);
    syncSelection(clue.cells[0], clue.direction);
    requestAnimationFrame(() => boardRef.current?.focus());
  }

  const clueNumberSize = Math.max(7, Math.min(12, 180 / puzzle.width));
  const letterSize = Math.max(18, Math.min(30, 450 / puzzle.width));

  return (
    <main className="min-h-screen p-4 sm:p-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-zinc-500">
              <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-500" : "bg-red-400"}`} />
              Crossword Party · Room {roomId}
            </div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">{puzzle.title}</h1>
            <p className="mt-1 text-sm text-zinc-500">
              {puzzle.author}
              {puzzle.copyright ? ` · ${puzzle.copyright}` : ""}
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowErrors((v) => !v)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-50"
            >
              {showErrors ? "Hide errors" : "Check errors"}
            </button>
            <button
              onClick={resetBoard}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-50"
            >
              Clear
            </button>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,700px)_minmax(280px,1fr)]">
          <section>
            <div
              ref={boardRef}
              tabIndex={0}
              onKeyDown={handleKeyDown}
              className="mx-auto max-w-[700px] outline-none"
              style={{ containerType: "inline-size" }}
              aria-label="Crossword board. Use your keyboard to enter letters."
            >
              <div
                className="grid w-full border-2 border-zinc-900 bg-zinc-900"
                style={{
                  gridTemplateColumns: `repeat(${puzzle.width}, minmax(0, 1fr))`,
                  gridTemplateRows: `repeat(${puzzle.height}, minmax(0, 1fr))`,
                  aspectRatio: `${puzzle.width} / ${puzzle.height}`,
                }}
              >
                {puzzle.cells.map((cell) => {
                  const id = `${cell.row}-${cell.column}`;
                  if (cell.isBlock) return <div key={id} className="bg-zinc-900" />;

                  const value = values[id] ?? "";
                  const wrong = showErrors && value && value !== cell.answer;
                  const active = activeCells.has(id);
                  const selectedHere = selected === id;
                  const remoteSelections = remotePlayers.filter(
                    (player) => player.selected === id,
                  );
                  const startingClue = puzzle.clues.find(
                    (c) => c.row === cell.row && c.column === cell.column,
                  );

                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => selectCell(id)}
                      className={`relative flex items-center justify-center border border-zinc-400 text-[length:var(--letter-size)] font-semibold ${
                        active ? "bg-amber-100" : "bg-white"
                      } ${
                        selectedHere ? "ring-2 ring-inset ring-blue-500" : ""
                      } ${wrong ? "text-red-600" : "text-zinc-900"}`}
                      style={
                        { "--letter-size": `${letterSize}px` } as React.CSSProperties
                      }
                    >
                      {startingClue && (
                        <span
                          className="absolute left-0.5 top-0.5 text-[length:var(--clue-number-size)] font-normal leading-none text-zinc-600"
                          style={
                            { "--clue-number-size": `${clueNumberSize}px` } as React.CSSProperties
                          }
                        >
                          {startingClue.number}
                        </span>
                      )}

                      {remoteSelections.length > 0 && (
                        <span className="absolute bottom-0.5 right-0.5 flex gap-0.5">
                          {remoteSelections.map((player) => (
                            <span
                              key={player.id}
                              title={`${player.name}'s cursor`}
                              className="h-2 w-2 rounded-full border border-white bg-blue-500"
                            />
                          ))}
                        </span>
                      )}

                      {value}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-600">
              <span>{filled} / {total} squares filled</span>
              {solved && (
                <span className="rounded-full bg-emerald-100 px-3 py-1 font-semibold text-emerald-800">
                  🎉 Puzzle solved!
                </span>
              )}
            </div>
          </section>

          <aside className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="mb-4 rounded-lg bg-zinc-100 p-1">
              <div className="flex gap-2">
                {(["ACROSS", "DOWN"] as Direction[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDirectionAndSync(d)}
                    className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold ${
                      direction === d ? "bg-white shadow-sm" : "text-zinc-500"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4 rounded-lg bg-zinc-50 p-3">
              <div className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                Players
              </div>
              <div className="mt-2 space-y-1">
                {players.map((player) => (
                  <div key={player.id} className="flex items-center gap-2 text-sm">
                    <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                    <span className="truncate">
                      {player.name}
                      {player.id === playerId ? " (you)" : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-3 rounded-lg bg-zinc-50 p-3">
              <div className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                Current Clue
              </div>
              <div className="mt-1 font-semibold">
                {activeClue
                  ? `${activeClue.number}${activeClue.direction === "ACROSS" ? "A" : "D"} · ${activeClue.text}`
                  : "Select a square"}
              </div>
            </div>

            <div className="max-h-[60vh] space-y-1 overflow-auto pr-1">
              {puzzle.clues
                .filter((c) => c.direction === direction)
                .map((clue) => (
                  <button
                    key={`${clue.direction}-${clue.number}`}
                    onClick={() => selectClue(clue)}
                    className={`block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-zinc-100 ${
                      activeClue?.number === clue.number &&
                      activeClue.direction === clue.direction
                        ? "bg-amber-100"
                        : ""
                    }`}
                  >
                    <span className="mr-2 font-bold">{clue.number}.</span>
                    {clue.text}
                  </button>
                ))}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
