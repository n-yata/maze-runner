const HIGH_SCORE_KEY = 'mazerun_highscore';

export class StorageManager {
  getHighScore(): number {
    try {
      const raw = localStorage.getItem(HIGH_SCORE_KEY);
      if (raw === null) return 0;
      const val = parseInt(raw, 10);
      return isNaN(val) || val < 0 ? 0 : val;
    } catch {
      return 0;
    }
  }

  setHighScore(score: number): void {
    try {
      if (score > this.getHighScore()) {
        localStorage.setItem(HIGH_SCORE_KEY, String(score));
      }
    } catch {
      // localStorage unavailable (private browsing etc.)
    }
  }

  clear(): void {
    try {
      localStorage.removeItem(HIGH_SCORE_KEY);
    } catch {
      // ignore
    }
  }
}
