export type PlaybackSpeed = 0.5 | 1 | 2 | 4;

export type PlaybackState = 'idle' | 'playing' | 'paused' | 'ended';

export type PlaybackListener = (state: PlaybackController) => void;

export class PlaybackController {
  private _currentIndex: number = 0;
  private _state: PlaybackState = 'idle';
  private _speed: PlaybackSpeed = 1;
  private _totalSteps: number;
  private _timer: ReturnType<typeof setTimeout> | null = null;
  private _listeners: Set<PlaybackListener> = new Set();
  private _baseDelay: number = 1500;

  constructor(totalSteps: number) {
    this._totalSteps = totalSteps;
  }

  get currentIndex(): number {
    return this._currentIndex;
  }

  get state(): PlaybackState {
    return this._state;
  }

  get speed(): PlaybackSpeed {
    return this._speed;
  }

  get totalSteps(): number {
    return this._totalSteps;
  }

  get progress(): number {
    if (this._totalSteps === 0) return 0;
    return this._currentIndex / (this._totalSteps - 1);
  }

  get isPlaying(): boolean {
    return this._state === 'playing';
  }

  subscribe(listener: PlaybackListener): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  private notify(): void {
    this._listeners.forEach((l) => l(this));
  }

  private getDelay(): number {
    return this._baseDelay / this._speed;
  }

  private scheduleNext(): void {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    if (this._state !== 'playing') return;
    if (this._currentIndex >= this._totalSteps - 1) {
      this._state = 'ended';
      this.notify();
      return;
    }
    this._timer = setTimeout(() => {
      this._currentIndex++;
      this.notify();
      this.scheduleNext();
    }, this.getDelay());
  }

  play(): void {
    if (this._state === 'playing') return;
    if (this._currentIndex >= this._totalSteps - 1) {
      this._currentIndex = 0;
    }
    this._state = 'playing';
    this.notify();
    this.scheduleNext();
  }

  pause(): void {
    if (this._state !== 'playing') return;
    this._state = 'paused';
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    this.notify();
  }

  stepForward(): void {
    this.pause();
    if (this._currentIndex < this._totalSteps - 1) {
      this._currentIndex++;
      this.notify();
    }
  }

  stepBack(): void {
    this.pause();
    if (this._currentIndex > 0) {
      this._currentIndex--;
      this.notify();
    }
  }

  seekTo(index: number): void {
    this.pause();
    const clamped = Math.max(0, Math.min(index, this._totalSteps - 1));
    this._currentIndex = clamped;
    this.notify();
  }

  setSpeed(speed: PlaybackSpeed): void {
    this._speed = speed;
    if (this._state === 'playing') {
      if (this._timer) {
        clearTimeout(this._timer);
      }
      this.scheduleNext();
    }
    this.notify();
  }

  setBaseDelay(ms: number): void {
    this._baseDelay = ms;
    if (this._state === 'playing') {
      if (this._timer) {
        clearTimeout(this._timer);
      }
      this.scheduleNext();
    }
  }

  reset(): void {
    this.pause();
    this._currentIndex = 0;
    this._state = 'idle';
    this.notify();
  }

  destroy(): void {
    this.pause();
    this._listeners.clear();
  }
}
