export type BoardEntry = {
  name: string;
  score: number;
  wave: number;
  at: number;
};

export type Settings = {
  mute: boolean;
  auto: boolean;
};

const BOARD_KEY = "ashwake-board-v1";
const SETTINGS_KEY = "ashwake-settings-v1";

function isEntry(value: unknown): value is BoardEntry {
  if (!value || typeof value !== "object") return false;
  const row = value as BoardEntry;
  return (
    typeof row.name === "string" &&
    row.name.length > 0 &&
    typeof row.score === "number" &&
    typeof row.wave === "number"
  );
}

export function loadBoard(): BoardEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(BOARD_KEY);
    if (!raw) return [];
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter(isEntry).slice(0, 8);
  } catch {
    return [];
  }
}

export function qualifies(board: BoardEntry[], score: number): boolean {
  if (score <= 0) return false;
  if (board.length < 8) return true;
  return score > board[board.length - 1]!.score;
}

export function saveScore(entry: BoardEntry): BoardEntry[] {
  const next = [...loadBoard(), entry]
    .sort((a, b) => b.score - a.score || a.at - b.at)
    .slice(0, 8);
  localStorage.setItem(BOARD_KEY, JSON.stringify(next));
  return next;
}

export function loadSettings(): Settings {
  if (typeof localStorage === "undefined") return { mute: false, auto: true };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { mute: false, auto: true };
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object") return { mute: false, auto: true };
    const row = data as Settings;
    return {
      mute: Boolean(row.mute),
      auto: row.auto !== false,
    };
  } catch {
    return { mute: false, auto: true };
  }
}

export function saveSettings(settings: Settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
