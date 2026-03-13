// ─── Game State Machine ───

export enum GameState {
  IDLE = 'IDLE',
  SPINNING = 'SPINNING',
  EVALUATING = 'EVALUATING',
  CASCADING = 'CASCADING',
  PAYOUT = 'PAYOUT',
  BONUS_TRIGGER = 'BONUS_TRIGGER',
  FREE_SPIN_MODE = 'FREE_SPIN_MODE',
  ROUND_COMPLETE = 'ROUND_COMPLETE',
}

export type GameEvent =
  | 'SPIN'
  | 'REELS_STOPPED'
  | 'WIN_FOUND'
  | 'NO_WIN'
  | 'CASCADE_DONE'
  | 'PAYOUT_DONE'
  | 'BONUS_TRIGGERED'
  | 'BONUS_SHOWN'
  | 'FREE_SPIN_START'
  | 'FREE_SPIN_END'
  | 'ROUND_END';

/**
 * State transition table for the slot game.
 */
const transitions: Record<GameState, Partial<Record<GameEvent, GameState>>> = {
  [GameState.IDLE]: {
    SPIN: GameState.SPINNING,
  },
  [GameState.SPINNING]: {
    REELS_STOPPED: GameState.EVALUATING,
  },
  [GameState.EVALUATING]: {
    WIN_FOUND: GameState.PAYOUT,
    NO_WIN: GameState.ROUND_COMPLETE,
    BONUS_TRIGGERED: GameState.BONUS_TRIGGER,
  },
  [GameState.PAYOUT]: {
    PAYOUT_DONE: GameState.CASCADING,
  },
  [GameState.CASCADING]: {
    CASCADE_DONE: GameState.EVALUATING,
  },
  [GameState.BONUS_TRIGGER]: {
    BONUS_SHOWN: GameState.FREE_SPIN_MODE,
  },
  [GameState.FREE_SPIN_MODE]: {
    FREE_SPIN_START: GameState.SPINNING,
    FREE_SPIN_END: GameState.ROUND_COMPLETE,
  },
  [GameState.ROUND_COMPLETE]: {
    ROUND_END: GameState.IDLE,
    SPIN: GameState.SPINNING,        // Quick re-spin
    FREE_SPIN_START: GameState.SPINNING, // Auto free spin
  },
};

export class StateMachine {
  private _state: GameState = GameState.IDLE;
  private _listeners: Array<(state: GameState, event: GameEvent) => void> = [];

  get state(): GameState {
    return this._state;
  }

  /**
   * Attempt a state transition. Returns true if successful.
   */
  transition(event: GameEvent): boolean {
    const nextState = transitions[this._state]?.[event];
    if (!nextState) {
      console.warn(
        `[StateMachine] Invalid transition: ${this._state} + ${event}`
      );
      return false;
    }
    this._state = nextState;
    this._listeners.forEach(fn => fn(nextState, event));
    return true;
  }

  /**
   * Force a state (use sparingly, e.g. reset).
   */
  reset() {
    this._state = GameState.IDLE;
  }

  onChange(fn: (state: GameState, event: GameEvent) => void) {
    this._listeners.push(fn);
    return () => {
      this._listeners = this._listeners.filter(l => l !== fn);
    };
  }

  canTransition(event: GameEvent): boolean {
    return !!transitions[this._state]?.[event];
  }
}
