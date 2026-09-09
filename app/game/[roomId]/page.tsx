import { loadPuzzle } from '../../../lib/puzzle/load-puzzle';
import CrosswordBoard from '../../../components/CrosswordBoard';

export default async function GamePage({ params }: { params: { roomId: string } }) {
  const puzzle = await loadPuzzle();
  return <CrosswordBoard puzzle={puzzle} roomId={params.roomId} />;
}
