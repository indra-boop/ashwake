import { audio } from "@/game/audio";

export const VW = 390;
export const VH = 640;

export type Phase = "title" | "play" | "pause" | "over";
export type Kind = "dart" | "manta" | "brute";
export type PickupKind = "multi" | "shield" | "speed" | "life";
export type Tone = "bone" | "ion" | "flare" | "amber";

export type Input = {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  fire: boolean;
  pointer: { x: number; y: number; touch: boolean } | null;
};

type Bullet = {
  alive: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  friendly: boolean;
  life: number;
};

type Enemy = {
  alive: boolean;
  kind: Kind;
  x: number;
  y: number;
  vy: number;
  r: number;
  hp: number;
  flash: number;
  shoot: number;
  phase: number;
  shoots: boolean;
};

type Pickup = {
  alive: boolean;
  kind: PickupKind;
  x: number;
  y: number;
  phase: number;
  life: number;
};

type Particle = {
  alive: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  tone: Tone;
  size: number;
};

type FloatText = {
  alive: boolean;
  x: number;
  y: number;
  text: string;
  life: number;
};

type Muzzle = { alive: boolean; x: number; y: number; life: number };
type Boom = { alive: boolean; x: number; y: number; life: number; max: number; scale: number };

type Star = { x: number; y: number; z: number; s: number };

type Spawn = { t: number; kind: Kind; x: number; shoots: boolean };

export type Player = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  bank: number;
  r: number;
  lives: number;
  invuln: number;
  fireCd: number;
  multi: number;
  multiT: number;
  shield: number;
  speedT: number;
  dying: number;
  trail: number;
};

export type Game = {
  phase: Phase;
  time: number;
  score: number;
  wave: number;
  banner: number;
  waveAge: number;
  clearT: number;
  cleared: boolean;
  combo: number;
  comboT: number;
  shake: number;
  hitStop: number;
  queue: Spawn[];
  player: Player;
  bullets: Bullet[];
  enemies: Enemy[];
  pickups: Pickup[];
  particles: Particle[];
  texts: FloatText[];
  muzzles: Muzzle[];
  booms: Boom[];
  stars: Star[];
  reduced: boolean;
};

const SPEED = 268;
const MULTI_TIME = 12;
const SPEED_TIME = 8;

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function make<T>(n: number, factory: () => T): T[] {
  return Array.from({ length: n }, factory);
}

export function createGame(reduced = false): Game {
  const stars = make(78, () => ({
    x: Math.random() * VW,
    y: Math.random() * VH,
    z: Math.random(),
    s: 0.6 + Math.random() * 1.6,
  }));
  return {
    phase: "title",
    time: 0,
    score: 0,
    wave: 1,
    banner: 0,
    waveAge: 0,
    clearT: 0,
    cleared: false,
    combo: 1,
    comboT: 0,
    shake: 0,
    hitStop: 0,
    queue: [],
    player: freshPlayer(),
    bullets: make(110, () => deadBullet()),
    enemies: make(28, () => deadEnemy()),
    pickups: make(6, () => deadPickup()),
    particles: make(200, () => deadParticle()),
    texts: make(14, () => deadText()),
    muzzles: make(12, () => ({ alive: false, x: 0, y: 0, life: 0 })),
    booms: make(10, () => ({ alive: false, x: 0, y: 0, life: 0, max: 0.4, scale: 1 })),
    stars,
    reduced,
  };
}

function freshPlayer(): Player {
  return {
    x: VW / 2,
    y: VH * 0.78,
    vx: 0,
    vy: 0,
    bank: 0,
    r: 12,
    lives: 3,
    invuln: 0,
    fireCd: 0,
    multi: 0,
    multiT: 0,
    shield: 0,
    speedT: 0,
    dying: 0,
    trail: 0,
  };
}

function deadBullet(): Bullet {
  return { alive: false, x: 0, y: 0, vx: 0, vy: 0, r: 5, friendly: true, life: 0 };
}
function deadEnemy(): Enemy {
  return {
    alive: false,
    kind: "dart",
    x: 0,
    y: 0,
    vy: 0,
    r: 12,
    hp: 1,
    flash: 0,
    shoot: 0,
    phase: 0,
    shoots: false,
  };
}
function deadPickup(): Pickup {
  return { alive: false, kind: "multi", x: 0, y: 0, phase: 0, life: 0 };
}
function deadParticle(): Particle {
  return { alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, tone: "bone", size: 2 };
}
function deadText(): FloatText {
  return { alive: false, x: 0, y: 0, text: "", life: 0 };
}

function take<T extends { alive: boolean }>(pool: T[]): T | null {
  for (const item of pool) {
    if (!item.alive) {
      item.alive = true;
      return item;
    }
  }
  return null;
}

export function resetRun(game: Game) {
  game.phase = "play";
  game.time = 0;
  game.score = 0;
  game.wave = 1;
  game.combo = 1;
  game.comboT = 0;
  game.shake = 0;
  game.hitStop = 0;
  game.player = freshPlayer();
  game.player.invuln = 1.1;
  for (const pool of [game.bullets, game.enemies, game.pickups, game.particles, game.texts, game.muzzles, game.booms]) {
    for (const item of pool) item.alive = false;
  }
  beginWave(game);
}

function beginWave(game: Game) {
  game.waveAge = 0;
  game.clearT = 0;
  game.cleared = false;
  game.banner = 1.7;
  game.queue = planWave(game.wave);
  if (game.wave === 1) dropPickup(game, VW * 0.3, -16, "multi");
  else dropPickup(game, VW * (0.28 + Math.random() * 0.44), -16);
  audio.wave();
}

function planWave(wave: number): Spawn[] {
  const count = 6 + wave * 2;
  const gap = Math.max(0.26, 0.52 - wave * 0.025);
  const lanes = [0.16, 0.34, 0.5, 0.66, 0.84];
  const spawns: Spawn[] = [];
  for (let i = 0; i < count; i++) {
    const roll = Math.random();
    let kind: Kind = "dart";
    if (wave >= 3 && roll > 0.84) kind = "brute";
    else if (wave >= 2 && roll > 0.48) kind = "manta";
    const lane = lanes[i % lanes.length]!;
    const x = clamp(lane * VW + (Math.random() - 0.5) * 28, 32, VW - 32);
    const shoots =
      kind === "brute" ? wave >= 2 : kind === "manta" ? wave >= 3 && Math.random() < 0.72 : wave >= 2 && Math.random() < 0.5;
    spawns.push({ t: i * gap, kind, x, shoots });
  }
  return spawns;
}

function spawnEnemy(game: Game, spawn: Spawn) {
  const enemy = take(game.enemies);
  if (!enemy) return;
  enemy.kind = spawn.kind;
  enemy.x = spawn.x;
  enemy.y = -36;
  enemy.phase = Math.random() * Math.PI * 2;
  enemy.flash = 0;
  enemy.shoots = spawn.shoots;
  enemy.shoot = 0.7 + Math.random() * 1.1;
  if (spawn.kind === "dart") {
    enemy.vy = Math.min(250, 128 + game.wave * 7);
    enemy.r = 13;
    enemy.hp = 1;
  } else if (spawn.kind === "manta") {
    enemy.vy = Math.min(210, 96 + game.wave * 5);
    enemy.r = 18;
    enemy.hp = 2;
  } else {
    enemy.vy = Math.min(150, 58 + game.wave * 3);
    enemy.r = 22;
    enemy.hp = 4;
  }
}

function burst(game: Game, x: number, y: number, n: number, tone: Tone, speed: number) {
  for (let i = 0; i < n; i++) {
    const p = take(game.particles);
    if (!p) return;
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.35 + Math.random());
    p.x = x;
    p.y = y;
    p.vx = Math.cos(a) * s;
    p.vy = Math.sin(a) * s;
    p.life = 0.25 + Math.random() * 0.35;
    p.max = p.life;
    p.tone = tone;
    p.size = 1.4 + Math.random() * 2.2;
  }
}

function floatText(game: Game, x: number, y: number, text: string) {
  const t = take(game.texts);
  if (!t) return;
  t.x = x;
  t.y = y;
  t.text = text;
  t.life = 0.75;
}

function boom(game: Game, x: number, y: number, scale: number) {
  const b = take(game.booms);
  if (!b) return;
  b.x = x;
  b.y = y;
  b.life = 0.42;
  b.max = 0.42;
  b.scale = scale;
}

function addScore(game: Game, base: number, x: number, y: number) {
  if (game.comboT > 0) game.combo = Math.min(6, game.combo + 1);
  else game.combo = 1;
  game.comboT = 1.15;
  const gained = base * game.combo;
  game.score += gained;
  floatText(game, x, y, game.combo > 1 ? `+${gained}  x${game.combo}` : `+${gained}`);
}

function dropPickup(game: Game, x: number, y: number, forced?: PickupKind) {
  if (!forced && game.pickups.some((p) => p.alive)) {
    if (Math.random() > 0.35) return;
  }
  const p = take(game.pickups);
  if (!p) return;
  const roll = Math.random();
  p.kind = forced ?? (roll < 0.36 ? "multi" : roll < 0.64 ? "shield" : roll < 0.9 ? "speed" : "life");
  p.x = clamp(x, 28, VW - 28);
  p.y = y;
  p.phase = Math.random() * 6;
  p.life = 9;
}

function killEnemy(game: Game, enemy: Enemy) {
  enemy.alive = false;
  const base = enemy.kind === "dart" ? 100 : enemy.kind === "manta" ? 160 : 400;
  addScore(game, base, enemy.x, enemy.y);
  boom(game, enemy.x, enemy.y, enemy.kind === "brute" ? 1.35 : enemy.kind === "manta" ? 1.05 : 0.85);
  burst(game, enemy.x, enemy.y, enemy.kind === "brute" ? 18 : 10, enemy.kind === "brute" ? "flare" : "amber", 140);
  audio.boom();
  game.shake = Math.max(game.shake, enemy.kind === "brute" ? 9 : 3.5);
  if (enemy.kind === "brute") game.hitStop = Math.max(game.hitStop, 0.045);
  const chance = enemy.kind === "brute" ? 0.85 : 0.09 + game.wave * 0.008;
  if (Math.random() < chance) dropPickup(game, enemy.x, enemy.y);
}

function hurtPlayer(game: Game) {
  const player = game.player;
  if (player.invuln > 0 || player.dying > 0 || game.phase !== "play") return;
  if (player.shield > 0) {
    player.shield -= 1;
    player.invuln = 0.45;
    game.shake = Math.max(game.shake, 6);
    burst(game, player.x, player.y, 12, "ion", 160);
    floatText(game, player.x, player.y - 20, "BLOCK");
    audio.hit();
    return;
  }
  player.lives -= 1;
  player.invuln = 1.65;
  game.shake = Math.max(game.shake, 12);
  game.hitStop = Math.max(game.hitStop, 0.07);
  burst(game, player.x, player.y, 16, "flare", 180);
  audio.hurt();
  if (player.lives <= 0) {
    player.dying = 0.85;
    boom(game, player.x, player.y, 1.5);
    player.vx = 0;
    player.vy = 0;
  }
}

function firePlayer(game: Game) {
  const player = game.player;
  const offsets = player.multi >= 2 ? [-22, -11, 0, 11, 22] : player.multi === 1 ? [-14, 0, 14] : [0];
  for (const off of offsets) {
    const b = take(game.bullets);
    if (!b) break;
    b.friendly = true;
    b.x = player.x + off;
    b.y = player.y - 24;
    b.vx = off * 1.15 + player.vx * 0.04;
    b.vy = -680;
    b.r = 5;
    b.life = 1.2;
  }
  const muzzle = take(game.muzzles);
  if (muzzle) {
    muzzle.x = player.x;
    muzzle.y = player.y - 28;
    muzzle.life = 0.09;
  }
  audio.shoot();
}

function fireEnemy(game: Game, enemy: Enemy) {
  const player = game.player;
  const aliveShots = game.bullets.reduce((n, b) => n + (b.alive && !b.friendly ? 1 : 0), 0);
  if (aliveShots > 22) return;
  const base = Math.atan2(player.y - enemy.y, player.x - enemy.x);
  const spreads = enemy.kind === "brute" ? [-0.28, 0, 0.28] : [0];
  const speed = enemy.kind === "brute" ? 200 : 240;
  for (const spread of spreads) {
    const b = take(game.bullets);
    if (!b) return;
    const a = base + spread;
    b.friendly = false;
    b.x = enemy.x;
    b.y = enemy.y + enemy.r * 0.4;
    b.vx = Math.cos(a) * speed;
    b.vy = Math.sin(a) * speed;
    b.r = 6;
    b.life = 3.2;
  }
}

function applyPickup(game: Game, kind: PickupKind) {
  const player = game.player;
  if (kind === "multi") {
    player.multi = Math.min(2, player.multi + 1);
    player.multiT = MULTI_TIME;
    floatText(game, player.x, player.y - 28, player.multi >= 2 ? "SPREAD" : "MULTI");
  } else if (kind === "shield") {
    player.shield = Math.min(2, player.shield + 1);
    floatText(game, player.x, player.y - 28, "SHIELD");
  } else if (kind === "speed") {
    player.speedT = SPEED_TIME;
    floatText(game, player.x, player.y - 28, "SPEED");
  } else {
    player.lives = Math.min(5, player.lives + 1);
    floatText(game, player.x, player.y - 28, "RESERVE");
  }
  audio.pickup(kind);
}

function stepStars(game: Game, dt: number) {
  const rate = game.reduced ? 0.35 : 1;
  for (const star of game.stars) {
    const speed = (18 + star.z * star.z * 150) * rate;
    star.y += speed * dt;
    if (star.y > VH + 4) {
      star.y = -4;
      star.x = Math.random() * VW;
    }
  }
}

function stepFx(game: Game, dt: number) {
  for (const p of game.particles) {
    if (!p.alive) continue;
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.98;
    p.vy *= 0.98;
    if (p.life <= 0) p.alive = false;
  }
  for (const m of game.muzzles) {
    if (!m.alive) continue;
    m.life -= dt;
    if (m.life <= 0) m.alive = false;
  }
  for (const b of game.booms) {
    if (!b.alive) continue;
    b.life -= dt;
    if (b.life <= 0) b.alive = false;
  }
  for (const t of game.texts) {
    if (!t.alive) continue;
    t.life -= dt;
    t.y -= 28 * dt;
    if (t.life <= 0) t.alive = false;
  }
}

function movePlayer(game: Game, input: Input, dt: number) {
  const player = game.player;
  const speed = player.speedT > 0 ? SPEED * 1.42 : SPEED;
  let ix = 0;
  let iy = 0;
  if (input.left) ix -= 1;
  if (input.right) ix += 1;
  if (input.up) iy -= 1;
  if (input.down) iy += 1;
  const mag = Math.hypot(ix, iy);
  let dx = 0;
  let dy = 0;
  if (mag > 0) {
    dx = (ix / mag) * speed;
    dy = (iy / mag) * speed;
  } else if (input.pointer && game.phase === "play") {
    const tx = input.pointer.x;
    const ty = input.pointer.touch ? input.pointer.y - 86 : input.pointer.y;
    const ox = tx - player.x;
    const oy = ty - player.y;
    const dist = Math.hypot(ox, oy);
    if (dist > 5) {
      const approach = Math.min(speed, dist * 8.5);
      dx = (ox / dist) * approach;
      dy = (oy / dist) * approach;
    }
  }
  const k = 1 - Math.exp(-12 * dt);
  player.vx += (dx - player.vx) * k;
  player.vy += (dy - player.vy) * k;
  player.x += player.vx * dt;
  player.y += player.vy * dt;
  const minX = 20;
  const maxX = VW - 20;
  const minY = 56;
  const maxY = VH - 24;
  if (player.x < minX) {
    player.x = minX;
    player.vx = Math.max(0, player.vx);
  } else if (player.x > maxX) {
    player.x = maxX;
    player.vx = Math.min(0, player.vx);
  }
  if (player.y < minY) {
    player.y = minY;
    player.vy = Math.max(0, player.vy);
  } else if (player.y > maxY) {
    player.y = maxY;
    player.vy = Math.min(0, player.vy);
  }
  const targetBank = clamp(player.vx / SPEED, -1, 1) * 0.6;
  player.bank += (targetBank - player.bank) * (1 - Math.exp(-14 * dt));
}

function overlaps(ax: number, ay: number, ar: number, bx: number, by: number, br: number) {
  const dx = ax - bx;
  const dy = ay - by;
  const r = ar + br;
  return dx * dx + dy * dy < r * r;
}

export function step(game: Game, input: Input, dt: number) {
  game.time += dt;
  stepStars(game, dt);

  if (game.phase === "title") {
    const player = game.player;
    player.x = VW / 2 + Math.sin(game.time * 0.7) * 22;
    player.y = VH * 0.4;
    player.vx = 0;
    player.vy = 0;
    player.bank = Math.sin(game.time * 0.7) * 0.18;
    return;
  }

  if (game.phase === "pause") return;

  if (game.phase === "over") {
    stepFx(game, dt);
    return;
  }

  const player = game.player;
  if (player.invuln > 0) player.invuln -= dt;
  if (player.multiT > 0) {
    player.multiT -= dt;
    if (player.multiT <= 0) {
      player.multiT = 0;
      player.multi = 0;
    }
  }
  if (player.speedT > 0) player.speedT = Math.max(0, player.speedT - dt);
  if (game.comboT > 0) {
    game.comboT -= dt;
    if (game.comboT <= 0) game.combo = 1;
  }
  if (game.banner > 0) game.banner = Math.max(0, game.banner - dt);

  if (player.dying > 0) {
    player.dying -= dt;
    stepFx(game, dt);
    if (player.dying <= 0) game.phase = "over";
    return;
  }

  movePlayer(game, input, dt);

  player.fireCd -= dt;
  if (input.fire && player.fireCd <= 0) {
    player.fireCd = player.multi > 0 ? 0.11 : 0.13;
    firePlayer(game);
  }

  player.trail -= dt;
  if (player.trail <= 0) {
    player.trail = player.speedT > 0 ? 0.03 : 0.05;
    const p = take(game.particles);
    if (p) {
      p.x = player.x + (Math.random() - 0.5) * 6;
      p.y = player.y + 22;
      p.vx = -player.vx * 0.1;
      p.vy = 40 + Math.random() * 50;
      p.life = 0.28;
      p.max = 0.28;
      p.tone = "amber";
      p.size = player.speedT > 0 ? 2.4 : 1.6;
    }
  }

  const aliveBefore = game.enemies.reduce((n, e) => n + (e.alive ? 1 : 0), 0);
  if (aliveBefore < 16) {
    game.waveAge += dt;
    let spawned = aliveBefore;
    while (game.queue.length && game.queue[0]!.t <= game.waveAge && spawned < 16) {
      spawnEnemy(game, game.queue.shift()!);
      spawned += 1;
    }
  }

  for (const enemy of game.enemies) {
    if (!enemy.alive) continue;
    if (enemy.kind === "manta") enemy.x += Math.sin(game.time * 2.15 + enemy.phase) * 100 * dt;
    else if (enemy.kind === "dart" && game.wave >= 2) {
      enemy.x += clamp((player.x - enemy.x) * 0.35, -50, 50) * dt;
    }
    enemy.x = clamp(enemy.x, 24, VW - 24);
    enemy.y += enemy.vy * dt;
    enemy.flash = Math.max(0, enemy.flash - dt);
    if (enemy.shoots && enemy.y > 30 && enemy.y < player.y - 20) {
      enemy.shoot -= dt;
      if (enemy.shoot <= 0) {
        fireEnemy(game, enemy);
        enemy.shoot = enemy.kind === "brute" ? 1.35 : 1.9;
      }
    }
    if (enemy.y > VH + 48) enemy.alive = false;
  }

  for (let i = 0; i < game.enemies.length; i++) {
    const a = game.enemies[i]!;
    if (!a.alive) continue;
    for (let j = i + 1; j < game.enemies.length; j++) {
      const b = game.enemies[j]!;
      if (!b.alive) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 1;
      const need = a.r + b.r + 6;
      if (dist < need) {
        const push = ((need - dist) / dist) * 0.5;
        a.x -= dx * push;
        b.x += dx * push;
      }
    }
  }

  for (const bullet of game.bullets) {
    if (!bullet.alive) continue;
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
    if (bullet.life <= 0 || bullet.y < -30 || bullet.y > VH + 30 || bullet.x < -30 || bullet.x > VW + 30) {
      bullet.alive = false;
    }
  }

  for (const bullet of game.bullets) {
    if (!bullet.alive || !bullet.friendly) continue;
    for (const enemy of game.enemies) {
      if (!enemy.alive) continue;
      if (!overlaps(bullet.x, bullet.y, bullet.r, enemy.x, enemy.y, enemy.r)) continue;
      bullet.alive = false;
      enemy.hp -= 1;
      enemy.flash = 0.08;
      burst(game, bullet.x, bullet.y, 4, "ion", 90);
      audio.hit();
      if (enemy.hp <= 0) killEnemy(game, enemy);
      break;
    }
  }

  if (player.invuln <= 0) {
    for (const enemy of game.enemies) {
      if (enemy.alive && overlaps(player.x, player.y, player.r, enemy.x, enemy.y, enemy.r * 0.85)) {
        hurtPlayer(game);
        break;
      }
    }
  }
  if (player.invuln <= 0 && player.dying <= 0) {
    for (const bullet of game.bullets) {
      if (!bullet.alive || bullet.friendly) continue;
      if (overlaps(player.x, player.y, player.r, bullet.x, bullet.y, bullet.r)) {
        bullet.alive = false;
        hurtPlayer(game);
        break;
      }
    }
  }

  for (const pickup of game.pickups) {
    if (!pickup.alive) continue;
    pickup.y += 58 * dt;
    pickup.x += Math.sin(game.time * 2 + pickup.phase) * 16 * dt;
    pickup.life -= dt;
    if (pickup.y > VH + 20 || pickup.life <= 0) pickup.alive = false;
    else if (overlaps(player.x, player.y, player.r + 6, pickup.x, pickup.y, 16)) {
      pickup.alive = false;
      applyPickup(game, pickup.kind);
    }
  }

  const enemiesLeft = game.enemies.some((e) => e.alive);
  if (!game.queue.length && !enemiesLeft) {
    game.clearT += dt;
    if (!game.cleared && game.clearT > 0.35) {
      game.cleared = true;
      const bonus = 250 * game.wave;
      game.score += bonus;
      floatText(game, VW / 2, VH * 0.42, `CLEAR +${bonus}`);
    }
    if (game.clearT > 1.55) {
      game.wave += 1;
      beginWave(game);
    }
  }

  stepFx(game, dt);
}

export const POWER = { multi: MULTI_TIME, speed: SPEED_TIME };
