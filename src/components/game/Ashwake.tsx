import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { ChevronDown, ChevronUp, Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { audio } from "@/game/audio";
import type { ControlsProbe } from "@/game/controlsTest";
import { draw, loadArt, type Art } from "@/game/draw";
import {
  createGame,
  POWER,
  resetRun,
  step,
  VH,
  VW,
  type Game,
  type Input,
  type Phase,
} from "@/game/sim";
import {
  loadBoard,
  loadSettings,
  qualifies,
  saveScore,
  saveSettings,
  type BoardEntry,
} from "@/game/storage";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

type Result = { score: number; wave: number; qualifies: boolean };

export function Ashwake() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scoreRef = useRef<HTMLSpanElement>(null);
  const waveRef = useRef<HTMLSpanElement>(null);
  const comboRef = useRef<HTMLSpanElement>(null);
  const multiRef = useRef<HTMLDivElement>(null);
  const speedRef = useRef<HTMLDivElement>(null);
  const keysRef = useRef(new Set<string>());
  const injectedRef = useRef<Set<string> | null>(null);
  const steerRef = useRef(0);
  const pointerRef = useRef<Input["pointer"]>(null);
  const fireRef = useRef(false);
  const autoRef = useRef(true);
  const phaseMirror = useRef<Phase>("title");
  const boardRef = useRef<BoardEntry[]>([]);
  const apiRef = useRef<{ launch: () => void; togglePause: () => void; game: Game } | null>(null);
  const hudSync = useRef({ lives: 3, shield: 0 });

  const [phase, setPhase] = useState<Phase>("title");
  const [board, setBoard] = useState<BoardEntry[]>([]);
  const [muted, setMuted] = useState(false);
  const [auto, setAuto] = useState(true);
  const [result, setResult] = useState<Result | null>(null);
  const [letters, setLetters] = useState(["A", "C", "E"]);
  const [slot, setSlot] = useState(0);
  const [logged, setLogged] = useState(false);
  const [ready, setReady] = useState(false);
  const [lives, setLives] = useState(3);
  const [shield, setShield] = useState(0);

  useEffect(() => {
    const settings = loadSettings();
    const savedBoard = loadBoard();
    boardRef.current = savedBoard;
    setBoard(savedBoard);
    setMuted(settings.mute);
    setAuto(settings.auto);
    autoRef.current = settings.auto;
    audio.setMuted(settings.mute);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const game = createGame(reduced);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let art: Art | null = null;
    void loadArt().then((loaded) => {
      art = loaded;
    });

    const paintHud = () => {
      if (scoreRef.current) scoreRef.current.textContent = game.score.toLocaleString("en-US");
      if (waveRef.current) waveRef.current.textContent = String(game.wave).padStart(2, "0");
      if (comboRef.current) {
        comboRef.current.textContent = game.combo > 1 ? `x${game.combo}` : "";
      }
      if (multiRef.current) {
        const row = multiRef.current;
        row.hidden = game.player.multi <= 0;
        const bar = row.querySelector("[data-bar]") as HTMLElement | null;
        if (bar) bar.style.width = `${(game.player.multiT / POWER.multi) * 100}%`;
      }
      if (speedRef.current) {
        const row = speedRef.current;
        row.hidden = game.player.speedT <= 0;
        const bar = row.querySelector("[data-bar]") as HTMLElement | null;
        if (bar) bar.style.width = `${(game.player.speedT / POWER.speed) * 100}%`;
      }
    };

    const probe: ControlsProbe = {
      getYaw: () => -game.player.bank,
      getSpeed: () => Math.hypot(game.player.vx, game.player.vy),
      getX: () => game.player.x,
      getY: () => game.player.y,
      setSteer: (v) => {
        steerRef.current = v;
      },
      setKeys: (codes) => {
        injectedRef.current = new Set(codes);
      },
    };
    window.__controlsTest = probe;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      ctx.setTransform((dpr * rect.width) / VW, 0, 0, (dpr * rect.height) / VH, 0, 0);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    let last = performance.now();
    let acc = 0;
    let raf = 0;
    let dead = false;

    const frame = (now: number) => {
      if (dead) return;
      const real = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (game.hitStop > 0) {
        game.hitStop = Math.max(0, game.hitStop - real);
      } else {
        acc += real;
        const stepDt = 1 / 60;
        let guard = 0;
        const input = readInput();
        while (acc >= stepDt && guard < 5) {
          step(game, input, stepDt);
          acc -= stepDt;
          guard += 1;
        }
      }
      game.shake *= Math.exp(-4.2 * real);
      ctx.save();
      if (game.shake > 0.2 && !game.reduced) {
        ctx.translate((Math.random() - 0.5) * game.shake, (Math.random() - 0.5) * game.shake);
      }
      draw(ctx, game, art ?? emptyArt);
      ctx.restore();
      paintHud();
      if (game.player.lives !== hudSync.current.lives || game.player.shield !== hudSync.current.shield) {
        hudSync.current = { lives: game.player.lives, shield: game.player.shield };
        setLives(game.player.lives);
        setShield(game.player.shield);
      }
      if (game.phase !== phaseMirror.current) {
        phaseMirror.current = game.phase;
        if (game.phase === "over") {
          setResult({
            score: game.score,
            wave: game.wave,
            qualifies: qualifies(boardRef.current, game.score),
          });
          setLogged(false);
          setLetters(["A", "C", "E"]);
          setSlot(0);
        }
        setPhase(game.phase);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    setReady(true);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Escape" || event.code === "KeyP") {
        if (game.phase === "play" || game.phase === "pause") {
          togglePause();
          event.preventDefault();
        }
        return;
      }
      if (game.phase === "title" && (event.code === "Enter" || event.code === "Space")) {
        event.preventDefault();
        launch();
        return;
      }
      keysRef.current.add(event.code);
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) {
        event.preventDefault();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      keysRef.current.delete(event.code);
    };
    const clearKeys = () => keysRef.current.clear();
    const onVis = () => {
      if (document.visibilityState === "visible") audio.resume();
      else if (game.phase === "play") {
        game.phase = "pause";
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", clearKeys);
    document.addEventListener("visibilitychange", onVis);

    function readInput(): Input {
      const held = injectedRef.current ?? keysRef.current;
      const down = (code: string) => held.has(code);
      let left = down("KeyA") || down("ArrowLeft");
      let right = down("KeyD") || down("ArrowRight");
      const up = down("KeyW") || down("ArrowUp");
      const downKey = down("KeyS") || down("ArrowDown");
      if (steerRef.current > 0.15) left = true;
      if (steerRef.current < -0.15) right = true;
      return {
        left,
        right,
        up,
        down: downKey,
        fire: autoRef.current || fireRef.current || down("Space") || down("KeyJ"),
        pointer: pointerRef.current,
      };
    }

    function launch() {
      audio.unlock();
      resetRun(game);
      phaseMirror.current = "play";
      setPhase("play");
      setResult(null);
    }

    function togglePause() {
      if (game.phase === "play") game.phase = "pause";
      else if (game.phase === "pause") game.phase = "play";
    }

    apiRef.current = { launch, togglePause, game };

    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", clearKeys);
      document.removeEventListener("visibilitychange", onVis);
      if (window.__controlsTest === probe) delete window.__controlsTest;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function launchFromUi() {
    audio.unlock();
    apiRef.current?.launch();
  }

  function toggleFromUi() {
    apiRef.current?.togglePause();
  }

  function restartFromUi() {
    audio.unlock();
    apiRef.current?.launch();
  }

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    audio.setMuted(next);
    audio.unlock();
    saveSettings({ mute: next, auto: autoRef.current });
  }

  function toggleAuto() {
    const next = !auto;
    setAuto(next);
    autoRef.current = next;
    saveSettings({ mute: muted, auto: next });
  }

  function logCallsign() {
    if (!result || logged || !result.qualifies) return;
    const name = letters.join("").slice(0, 3).toUpperCase();
    const next = saveScore({
      name,
      score: result.score,
      wave: result.wave,
      at: Date.now(),
    });
    boardRef.current = next;
    setBoard(next);
    setLogged(true);
  }

  function nudgeLetter(dir: number) {
    setLetters((current) => {
      const copy = [...current];
      const index = LETTERS.indexOf(copy[slot] ?? "A");
      copy[slot] = LETTERS[(index + dir + LETTERS.length) % LETTERS.length] ?? "A";
      return copy;
    });
  }

  useEffect(() => {
    if (phase !== "over" || logged) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.code === "ArrowLeft") {
        setSlot((s) => (s + 2) % 3);
        event.preventDefault();
      } else if (event.code === "ArrowRight") {
        setSlot((s) => (s + 1) % 3);
        event.preventDefault();
      } else if (event.code === "ArrowUp") {
        nudgeLetter(1);
        event.preventDefault();
      } else if (event.code === "ArrowDown") {
        nudgeLetter(-1);
        event.preventDefault();
      } else if (event.code === "Enter") {
        logCallsign();
        event.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, logged, slot, letters, result]);

  function worldPoint(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * VW,
      y: ((event.clientY - rect.top) / rect.height) * VH,
      touch: event.pointerType !== "mouse",
    };
  }

  const best = board[0]?.score ?? 0;

  return (
    <main className="shell">
      <h1 className="sr-only">ASHWAKE</h1>
      <section className="stage" data-phase={phase} data-ready={ready ? "1" : "0"} aria-label="Playfield">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full"
          onContextMenu={(event) => event.preventDefault()}
          onPointerDown={(event) => {
            if (phase !== "play") return;
            canvasRef.current?.setPointerCapture(event.pointerId);
            pointerRef.current = worldPoint(event);
            if (event.pointerType === "mouse" && event.button === 0) fireRef.current = true;
          }}
          onPointerMove={(event) => {
            if (phase !== "play") return;
            if (event.pointerType === "mouse" || event.currentTarget.hasPointerCapture(event.pointerId)) {
              pointerRef.current = worldPoint(event);
            }
          }}
          onPointerUp={(event) => {
            fireRef.current = false;
            if (event.pointerType !== "mouse") pointerRef.current = null;
          }}
          onPointerCancel={() => {
            fireRef.current = false;
            pointerRef.current = null;
          }}
          onPointerLeave={(event) => {
            if (event.pointerType === "mouse") pointerRef.current = null;
          }}
        />

        {phase === "play" ? (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-3">
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span ref={scoreRef} className="font-display text-5xl leading-none tabular-nums text-fg">
                  0
                </span>
                <span ref={comboRef} className="font-display text-2xl leading-none text-primary tabular-nums" />
              </div>
              <p className="mt-1 text-xs tracking-wide text-muted">
                WAVE <span ref={waveRef}>01</span>
              </p>
              <div className="mt-2 flex gap-1.5" aria-label="Lives">
                {Array.from({ length: 5 }, (_, i) => (
                  <span key={i} className={`size-2.5 rotate-45 ${i < lives ? "bg-primary" : "bg-surface-2"}`} />
                ))}
              </div>
              {shield > 0 ? (
                <div className="mt-2 flex gap-1" aria-label="Shield">
                  <span className={`size-2 rounded-full ${shield > 0 ? "bg-primary" : "bg-surface-2"}`} />
                  <span className={`size-2 rounded-full ${shield > 1 ? "bg-primary" : "bg-surface-2"}`} />
                </div>
              ) : null}
              <div ref={multiRef} hidden className="mt-2 w-24">
                <p className="text-xs tracking-wide text-muted">MULTI</p>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-2">
                  <div data-bar className="h-full w-0 bg-primary" />
                </div>
              </div>
              <div ref={speedRef} hidden className="mt-2 w-24">
                <p className="text-xs tracking-wide text-muted">SPEED</p>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-2">
                  <div data-bar className="h-full w-0 bg-primary" />
                </div>
              </div>
            </div>
            <button
              type="button"
              className="pointer-events-auto grid size-11 place-items-center rounded-lg border border-border bg-surface text-fg"
              onClick={toggleFromUi}
              aria-label="Pause"
            >
              <Pause className="size-5" />
            </button>
          </div>
        ) : null}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="pad pointer-events-auto grid grid-cols-3 gap-1.5">
            <span />
            <Hold label="Up" code="ArrowUp" keysRef={keysRef}>
              <ChevronUp className="size-5" />
            </Hold>
            <span />
            <Hold label="Left" code="ArrowLeft" keysRef={keysRef}>
              <ChevronUp className="size-5 -rotate-90" />
            </Hold>
            <Hold label="Down" code="ArrowDown" keysRef={keysRef}>
              <ChevronDown className="size-5" />
            </Hold>
            <Hold label="Right" code="ArrowRight" keysRef={keysRef}>
              <ChevronUp className="size-5 rotate-90" />
            </Hold>
          </div>
          <button
            type="button"
            aria-label="Fire"
            className="fire-pad pointer-events-auto grid size-16 place-items-center rounded-full border border-border bg-surface font-display text-xl text-primary"
            onPointerDown={(event) => {
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              fireRef.current = true;
            }}
            onPointerUp={() => {
              fireRef.current = false;
            }}
            onPointerCancel={() => {
              fireRef.current = false;
            }}
          >
            Fire
          </button>
        </div>

        {phase === "title" ? (
          <div className="absolute inset-0 z-30 flex items-end overflow-y-auto bg-bg/55 p-4">
            <div className="w-full rounded-lg border border-border bg-surface/95 p-4">
              <p className="text-xs tracking-[0.22em] text-primary">ION LANE</p>
              <p className="mt-1 font-display text-6xl leading-none text-fg">ASHWAKE</p>
              <p className="mt-2 text-sm text-pretty text-muted">
                Hold the lane. Break the waves. Log the wake you leave behind.
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  className="h-11 flex-1 rounded-lg bg-primary font-display text-2xl tracking-wide text-primary-ink disabled:opacity-50"
                  onClick={launchFromUi}
                  disabled={!ready}
                >
                  Start
                </button>
                <button
                  type="button"
                  className="grid size-11 place-items-center rounded-lg border border-border bg-surface-2 text-fg"
                  onClick={toggleMute}
                  aria-label={muted ? "Unmute" : "Mute"}
                >
                  {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
                </button>
              </div>
              <p className="mt-3 text-xs text-pretty text-muted">
                WASD or arrows to fly. Mouse or drag to steer. Space fires. Esc pauses. Auto-fire is {auto ? "on" : "off"}.
              </p>
              {best > 0 ? (
                <p className="mt-2 font-display text-2xl tabular-nums text-fg">BEST {best.toLocaleString("en-US")}</p>
              ) : null}
            </div>
          </div>
        ) : null}

        {phase === "pause" ? (
          <div className="absolute inset-0 z-30 flex items-center justify-center overflow-y-auto bg-bg/70 p-4">
            <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-4">
              <p className="font-display text-5xl leading-none text-fg">PAUSED</p>
              <p className="mt-2 text-sm text-muted">The lane holds still. Nothing scores while you wait.</p>
              <div className="mt-4 grid gap-2">
                <button
                  type="button"
                  autoFocus
                  className="flex h-11 items-center justify-center gap-2 rounded-lg bg-primary font-display text-2xl text-primary-ink"
                  onClick={toggleFromUi}
                >
                  <Play className="size-5" /> Resume
                </button>
                <button
                  type="button"
                  className="flex h-11 items-center justify-center gap-2 rounded-lg border border-border bg-surface-2 text-fg"
                  onClick={restartFromUi}
                >
                  <RotateCcw className="size-4" /> Restart
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className="h-11 rounded-lg border border-border text-sm text-fg"
                    onClick={toggleMute}
                  >
                    {muted ? "Sound off" : "Sound on"}
                  </button>
                  <button
                    type="button"
                    className="h-11 rounded-lg border border-border text-sm text-fg"
                    onClick={toggleAuto}
                  >
                    Auto-fire {auto ? "on" : "off"}
                  </button>
                </div>
              </div>
              <BoardList board={board.slice(0, 5)} />
            </div>
          </div>
        ) : null}

        {phase === "over" && result ? (
          <div className="absolute inset-0 z-30 flex items-center justify-center overflow-y-auto bg-bg/75 p-4">
            <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-4">
              <p className="text-xs tracking-[0.18em] text-danger">LANE LOST</p>
              <p className="font-display text-6xl leading-none tabular-nums text-fg">
                {result.score.toLocaleString("en-US")}
              </p>
              <p className="mt-1 text-sm text-muted">Wave {String(result.wave).padStart(2, "0")}</p>
              {result.qualifies && !logged ? (
                <div className="mt-4">
                  <p className="text-sm text-fg">Log a callsign</p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {letters.map((letter, index) => (
                      <div key={index} className="grid gap-1">
                        <button
                          type="button"
                          className="grid h-11 place-items-center rounded-lg border border-border text-fg"
                          aria-label={`Letter ${index + 1} up`}
                          onClick={() => {
                            setSlot(index);
                            setLetters((current) => {
                              const copy = [...current];
                              const at = LETTERS.indexOf(copy[index] ?? "A");
                              copy[index] = LETTERS[(at + 1) % LETTERS.length] ?? "A";
                              return copy;
                            });
                          }}
                        >
                          <ChevronUp className="size-4" />
                        </button>
                        <button
                          type="button"
                          className={`grid h-12 place-items-center rounded-lg border font-display text-3xl ${
                            slot === index ? "border-primary text-primary" : "border-border text-fg"
                          }`}
                          onClick={() => setSlot(index)}
                        >
                          {letter}
                        </button>
                        <button
                          type="button"
                          className="grid h-11 place-items-center rounded-lg border border-border text-fg"
                          aria-label={`Letter ${index + 1} down`}
                          onClick={() => {
                            setSlot(index);
                            setLetters((current) => {
                              const copy = [...current];
                              const at = LETTERS.indexOf(copy[index] ?? "A");
                              copy[index] = LETTERS[(at - 1 + LETTERS.length) % LETTERS.length] ?? "A";
                              return copy;
                            });
                          }}
                        >
                          <ChevronDown className="size-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="mt-3 h-11 w-full rounded-lg bg-primary font-display text-2xl text-primary-ink"
                    onClick={logCallsign}
                  >
                    Log callsign
                  </button>
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted">
                  {logged ? "Callsign locked on the board." : "Not enough wake to log."}
                </p>
              )}
              <button
                type="button"
                className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface-2 text-fg"
                onClick={restartFromUi}
              >
                <RotateCcw className="size-4" /> Fly again
              </button>
              <BoardList board={board.slice(0, 5)} />
            </div>
          </div>
        ) : null}
      </section>

      <aside className="dossier">
        <div>
          <p className="text-xs tracking-[0.22em] text-primary">ION LANE</p>
          <p className="font-display text-5xl leading-none text-fg">ASHWAKE</p>
          <p className="mt-2 text-sm text-pretty text-muted">
            A bone-white interceptor against iron raiders. Multi-shot, shield, and speed drift out of the wrecks.
          </p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs tracking-wide text-muted">HOW TO FLY</p>
          <ul className="mt-2 space-y-1 text-sm text-fg">
            <li>A and D slide the nose left and right.</li>
            <li>W and S climb or drop. Diagonals stay even.</li>
            <li>Pointer eases the ship toward the cursor.</li>
            <li>Space, click, or auto-fire keeps the lane hot.</li>
          </ul>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <BoardList board={board} bare />
        </div>
      </aside>
    </main>
  );
}

const emptyArt: Art = {
  player: null,
  dart: null,
  manta: null,
  brute: null,
  pickups: null,
  bolt: null,
  ebolt: null,
  muzzle: null,
  boom: null,
};

function BoardList({ board, bare = false }: { board: BoardEntry[]; bare?: boolean }) {
  return (
    <div className={bare ? "" : "mt-4"}>
      <p className="text-xs tracking-wide text-muted">HIGH SCORES</p>
      {board.length === 0 ? (
        <p className="mt-2 text-sm text-muted">No wakes logged yet.</p>
      ) : (
        <ol className="mt-2 space-y-1">
          {board.map((entry, index) => (
            <li key={`${entry.at}-${entry.name}-${index}`} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-muted tabular-nums">{String(index + 1).padStart(2, "0")}</span>
              <span className="flex-1 font-medium tracking-wide text-fg">{entry.name}</span>
              <span className="tabular-nums text-fg">{entry.score.toLocaleString("en-US")}</span>
              <span className="text-muted tabular-nums">W{entry.wave}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Hold({
  code,
  label,
  keysRef,
  children,
}: {
  code: string;
  label: string;
  keysRef: { current: Set<string> | null };
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className="grid size-11 place-items-center rounded-lg border border-border bg-surface text-fg"
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        keysRef.current?.add(code);
      }}
      onPointerUp={() => keysRef.current?.delete(code)}
      onPointerCancel={() => keysRef.current?.delete(code)}
    >
      {children}
    </button>
  );
}
