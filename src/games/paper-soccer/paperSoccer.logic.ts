export const FIELD_WIDTH = 8;
export const FIELD_HEIGHT = 10;
export const GOAL_LEFT = 3;
export const GOAL_RIGHT = 5;
export const START_POINT: PaperSoccerPoint = { x: FIELD_WIDTH / 2, y: FIELD_HEIGHT / 2 };

export type PaperSoccerPlayer = "home" | "away";
export type PaperSoccerGoal = "top" | "bottom";
export type PaperSoccerPoint = { x: number; y: number };
export type PaperSoccerSegment = { from: PaperSoccerPoint; to: PaperSoccerPoint; player: PaperSoccerPlayer };
export type PaperSoccerState = {
  ball: PaperSoccerPoint;
  turn: PaperSoccerPlayer;
  visitedPoints: string[];
  segments: PaperSoccerSegment[];
  winner: PaperSoccerPlayer | null;
};

export type PaperSoccerMoveResult = {
  moved: boolean;
  state: PaperSoccerState;
  bounce: boolean;
  winner: PaperSoccerPlayer | null;
  blockedLoser: PaperSoccerPlayer | null;
};

const DIRECTIONS: readonly PaperSoccerPoint[] = [
  { x: -1, y: -1 },
  { x: 0, y: -1 },
  { x: 1, y: -1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
  { x: -1, y: 1 },
  { x: 0, y: 1 },
  { x: 1, y: 1 },
] as const;

export function createInitialPaperSoccerState(): PaperSoccerState {
  return {
    ball: START_POINT,
    turn: "home",
    visitedPoints: [toPointKey(START_POINT)],
    segments: [],
    winner: null,
  };
}

export function toPointKey(point: PaperSoccerPoint): string {
  return `${point.x}:${point.y}`;
}

export function samePoint(first: PaperSoccerPoint, second: PaperSoccerPoint): boolean {
  return first.x === second.x && first.y === second.y;
}

export function getOpponent(player: PaperSoccerPlayer): PaperSoccerPlayer {
  return player === "home" ? "away" : "home";
}

export function getAttackedGoal(player: PaperSoccerPlayer): PaperSoccerGoal {
  return player === "home" ? "top" : "bottom";
}

export function getDefendedGoal(player: PaperSoccerPlayer): PaperSoccerGoal {
  return player === "home" ? "bottom" : "top";
}

export function getGoal(point: PaperSoccerPoint): PaperSoccerGoal | null {
  if (point.x < GOAL_LEFT || point.x > GOAL_RIGHT) return null;
  if (point.y === -1) return "top";
  if (point.y === FIELD_HEIGHT + 1) return "bottom";
  return null;
}

export function getScoringWinner(point: PaperSoccerPoint): PaperSoccerPlayer | null {
  const goal = getGoal(point);
  if (goal === "top") return "home";
  if (goal === "bottom") return "away";
  return null;
}

export function isPlayablePoint(point: PaperSoccerPoint): boolean {
  return isFieldPoint(point) || getGoal(point) !== null;
}

export function isBoundaryPoint(point: PaperSoccerPoint): boolean {
  return isFieldPoint(point) && (point.x === 0 || point.x === FIELD_WIDTH || point.y === 0 || point.y === FIELD_HEIGHT);
}

export function isLegalMove(state: PaperSoccerState, target: PaperSoccerPoint): boolean {
  if (state.winner) return false;
  if (!isPlayablePoint(target) || !isAdjacent(state.ball, target)) return false;
  if (isWallSegment(state.ball, target) || hasSegment(state.segments, state.ball, target)) return false;
  return true;
}

export function getLegalMoves(state: PaperSoccerState): PaperSoccerPoint[] {
  return DIRECTIONS.map((direction) => ({
    x: state.ball.x + direction.x,
    y: state.ball.y + direction.y,
  })).filter((target) => isLegalMove(state, target));
}

export function applyPaperSoccerMove(state: PaperSoccerState, target: PaperSoccerPoint): PaperSoccerMoveResult {
  if (!isLegalMove(state, target)) {
    return {
      moved: false,
      state,
      bounce: false,
      winner: state.winner,
      blockedLoser: null,
    };
  }

  const targetKey = toPointKey(target);
  const scoredWinner = getScoringWinner(target);
  const bounce = scoredWinner === null && (state.visitedPoints.includes(targetKey) || isBoundaryPoint(target));
  const nextTurn = bounce ? state.turn : getOpponent(state.turn);
  const nextVisitedPoints = state.visitedPoints.includes(targetKey) ? state.visitedPoints : [...state.visitedPoints, targetKey];

  const stateAfterMove: PaperSoccerState = {
    ball: target,
    turn: nextTurn,
    visitedPoints: nextVisitedPoints,
    segments: [...state.segments, { from: state.ball, to: target, player: state.turn }],
    winner: scoredWinner,
  };

  if (stateAfterMove.winner) {
    return {
      moved: true,
      state: stateAfterMove,
      bounce,
      winner: stateAfterMove.winner,
      blockedLoser: null,
    };
  }

  const blockedLoser = getLegalMoves(stateAfterMove).length === 0 ? nextTurn : null;
  const winner = blockedLoser ? getOpponent(blockedLoser) : null;
  const finalState = winner ? { ...stateAfterMove, winner } : stateAfterMove;

  return {
    moved: true,
    state: finalState,
    bounce,
    winner,
    blockedLoser,
  };
}

export function chooseAiMove(state: PaperSoccerState, player: PaperSoccerPlayer): PaperSoccerPoint | null {
  const legalMoves = getLegalMoves(state);
  if (legalMoves.length === 0) return null;

  const rankedMoves = legalMoves
    .map((target) => ({
      target,
      score: scoreMove(state, target, player),
    }))
    .sort((first, second) => second.score - first.score);

  const bestScore = rankedMoves[0]?.score ?? 0;
  const bestMoves = rankedMoves.filter((move) => move.score === bestScore);
  return bestMoves[Math.floor(Math.random() * bestMoves.length)]?.target ?? rankedMoves[0].target;
}

export function getGoalCenter(goal: PaperSoccerGoal): PaperSoccerPoint {
  return {
    x: FIELD_WIDTH / 2,
    y: goal === "top" ? -1 : FIELD_HEIGHT + 1,
  };
}

function scoreMove(state: PaperSoccerState, target: PaperSoccerPoint, player: PaperSoccerPlayer): number {
  const result = applyPaperSoccerMove(state, target);
  if (!result.moved) return Number.NEGATIVE_INFINITY;
  if (result.winner === player) return 10_000;
  if (result.winner === getOpponent(player)) return -10_000;

  const attackedGoal = getGoalCenter(getAttackedGoal(player));
  const defendedGoal = getGoalCenter(getDefendedGoal(player));
  const distanceToAttack = distance(target, attackedGoal);
  const distanceToDefense = distance(target, defendedGoal);
  const nextMoves = getLegalMoves(result.state).length;
  const centerControl = Math.abs(target.x - FIELD_WIDTH / 2);

  return distanceToDefense - distanceToAttack + nextMoves * 0.35 - centerControl * 0.25 + (result.bounce ? 1.2 : 0);
}

function isFieldPoint(point: PaperSoccerPoint): boolean {
  return point.x >= 0 && point.x <= FIELD_WIDTH && point.y >= 0 && point.y <= FIELD_HEIGHT;
}

function isAdjacent(from: PaperSoccerPoint, to: PaperSoccerPoint): boolean {
  const dx = Math.abs(from.x - to.x);
  const dy = Math.abs(from.y - to.y);
  return dx <= 1 && dy <= 1 && dx + dy > 0;
}

function isWallSegment(from: PaperSoccerPoint, to: PaperSoccerPoint): boolean {
  if (!isFieldPoint(from) || !isFieldPoint(to)) return false;
  if (from.x === to.x && (from.x === 0 || from.x === FIELD_WIDTH)) return true;
  if (from.y === to.y && (from.y === 0 || from.y === FIELD_HEIGHT)) return true;
  return false;
}

function hasSegment(segments: PaperSoccerSegment[], from: PaperSoccerPoint, to: PaperSoccerPoint): boolean {
  const nextKey = toSegmentKey(from, to);
  return segments.some((segment) => toSegmentKey(segment.from, segment.to) === nextKey);
}

function toSegmentKey(from: PaperSoccerPoint, to: PaperSoccerPoint): string {
  const first = toPointKey(from);
  const second = toPointKey(to);
  return first < second ? `${first}|${second}` : `${second}|${first}`;
}

function distance(from: PaperSoccerPoint, to: PaperSoccerPoint): number {
  return Math.hypot(from.x - to.x, from.y - to.y);
}
