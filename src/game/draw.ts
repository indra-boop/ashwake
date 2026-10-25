import type { Game, Kind, PickupKind } from "@/game/sim";
import { VH, VW } from "@/game/sim";

export type Art = {
  player: HTMLImageElement | null;
  dart: HTMLImageElement | null;
  manta: HTMLImageElement | null;
  brute: HTMLImageElement | null;
  pickups: HTMLImageElement | null;
  bolt: HTMLImageElement | null;
  ebolt: HTMLImageElement | null;
  muzzle: HTMLImageElement | null;
  boom: HTMLImageElement | null;
};

const ION = "#3ec7ff";
const BONE = "#e7eef4";
const FLARE = "#ff5d4a";
const AMBER = "#ffb15a";
const BG = "#07090d";

const TONE: Record<string, string> = { bone: BONE, ion: ION, flare: FLARE, amber: AMBER };

function blit(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  frame: number,
  x: number,
  y: number,
  w: number,
  h: number,
  rot = 0,
) {
  if (!img || !img.complete || img.naturalWidth === 0) return false;
  const fw = img.width / 2;
  const fh = img.height / 2;
  const c = frame % 2;
  const r = Math.floor(frame / 2) % 2;
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  ctx.drawImage(img, c * fw, r * fh, fw, fh, -w / 2, -h / 2, w, h);
  ctx.restore();
  return true;
}

function shipFallback(ctx: CanvasRenderingContext2D, x: number, y: number, rot: number, fill: string, scale: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(scale, scale);
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(0, -16);
  ctx.lineTo(10, 14);
  ctx.lineTo(0, 8);
  ctx.lineTo(-10, 14);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function draw(ctx: CanvasRenderingContext2D, game: Game, art: Art) {
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, VW, VH);

  const par = (game.player.x - VW / 2) * (game.reduced ? 0 : 0.04);
  for (const star of game.stars) {
    const depth = 0.25 + star.z;
    const x = star.x - par * depth;
    const alpha = 0.25 + star.z * 0.7;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = star.z > 0.86 ? ION : star.z > 0.72 ? AMBER : BONE;
    if (star.z > 0.8 && !game.reduced) {
      ctx.fillRect(x, star.y, star.s, star.s * 3.2);
    } else {
      ctx.fillRect(x, star.y, star.s, star.s);
    }
  }
  ctx.globalAlpha = 1;

  const frame = Math.floor(game.time * 8) % 4;

  for (const pickup of game.pickups) {
    if (!pickup.alive) continue;
    const index: Record<PickupKind, number> = { multi: 0, shield: 1, speed: 2, life: 3 };
    const bob = Math.sin(game.time * 3 + pickup.phase) * 3;
    if (!blit(ctx, art.pickups, index[pickup.kind], pickup.x, pickup.y + bob, 40, 40)) {
      ctx.fillStyle = ION;
      ctx.beginPath();
      ctx.arc(pickup.x, pickup.y, 10, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  for (const bullet of game.bullets) {
    if (!bullet.alive || bullet.friendly) continue;
    const f = Math.floor(game.time * 12 + bullet.x) % 4;
    if (!blit(ctx, art.ebolt, f, bullet.x, bullet.y, 26, 26)) {
      ctx.fillStyle = FLARE;
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  for (const enemy of game.enemies) {
    if (!enemy.alive) continue;
    const f = Math.floor(game.time * 8 + enemy.phase) % 4;
    const sheet = enemy.kind === "dart" ? art.dart : enemy.kind === "manta" ? art.manta : art.brute;
    const size = sizeFor(enemy.kind);
    ctx.save();
    if (enemy.flash > 0) ctx.globalAlpha = 1;
    const drawn = blit(ctx, sheet, f, enemy.x, enemy.y, size.w, size.h);
    if (!drawn) shipFallback(ctx, enemy.x, enemy.y, Math.PI, FLARE, enemy.kind === "brute" ? 1.5 : 1);
    if (enemy.flash > 0) {
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.85;
      blit(ctx, sheet, f, enemy.x, enemy.y, size.w, size.h);
    }
    ctx.restore();
  }

  for (const bullet of game.bullets) {
    if (!bullet.alive || !bullet.friendly) continue;
    const f = Math.floor(game.time * 14) % 4;
    if (!blit(ctx, art.bolt, f, bullet.x, bullet.y, 18, 40)) {
      ctx.fillStyle = ION;
      ctx.fillRect(bullet.x - 2, bullet.y - 10, 4, 16);
    }
  }

  for (const muzzle of game.muzzles) {
    if (!muzzle.alive) continue;
    const f = Math.min(3, Math.floor((1 - muzzle.life / 0.09) * 4));
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    blit(ctx, art.muzzle, f, muzzle.x, muzzle.y, 42, 56);
    ctx.fillStyle = ION;
    ctx.globalAlpha = muzzle.life / 0.09;
    ctx.beginPath();
    ctx.arc(muzzle.x, muzzle.y + 6, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const player = game.player;
  if (player.dying <= 0 && game.phase !== "over") {
    if (player.shield > 0) {
      ctx.save();
      ctx.strokeStyle = ION;
      ctx.globalAlpha = 0.45 + Math.sin(game.time * 8) * 0.2;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(player.x, player.y, 30, 0, Math.PI * 2);
      ctx.stroke();
      if (player.shield > 1) {
        ctx.beginPath();
        ctx.arc(player.x, player.y, 36, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
    const blink = player.invuln > 0 && Math.sin(game.time * 28) > 0;
    if (!blink) {
      const drawn = blit(ctx, art.player, frame, player.x, player.y, 54, 64, player.bank);
      if (!drawn) shipFallback(ctx, player.x, player.y, player.bank, BONE, 1.15);
    }
  }

  for (const boom of game.booms) {
    if (!boom.alive) continue;
    const f = Math.min(3, Math.floor((1 - boom.life / boom.max) * 4));
    const size = 92 * boom.scale;
    if (!blit(ctx, art.boom, f, boom.x, boom.y, size, size)) {
      ctx.fillStyle = AMBER;
      ctx.globalAlpha = boom.life / boom.max;
      ctx.beginPath();
      ctx.arc(boom.x, boom.y, size * 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const p of game.particles) {
    if (!p.alive) continue;
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = TONE[p.tone] ?? BONE;
    ctx.fillRect(p.x, p.y, p.size, p.size);
  }
  ctx.restore();
  ctx.globalAlpha = 1;

  ctx.font = '600 15px Sora, sans-serif';
  ctx.textAlign = "center";
  for (const text of game.texts) {
    if (!text.alive) continue;
    ctx.globalAlpha = Math.min(1, text.life * 2);
    ctx.fillStyle = BONE;
    ctx.fillText(text.text, text.x, text.y);
  }
  ctx.globalAlpha = 1;

  if (game.banner > 0 && game.phase === "play") {
    const u = game.banner / 1.7;
    ctx.globalAlpha = Math.sin(Math.min(1, u) * Math.PI);
    ctx.fillStyle = BONE;
    ctx.font = '700 64px "Big Shoulders Display", sans-serif';
    ctx.textAlign = "center";
    ctx.fillText(`WAVE ${String(game.wave).padStart(2, "0")}`, VW / 2, VH * 0.38);
    ctx.globalAlpha = 1;
  }

  const vignette = ctx.createRadialGradient(VW / 2, VH * 0.45, VH * 0.2, VW / 2, VH * 0.5, VH * 0.72);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, VW, VH);
}

function sizeFor(kind: Kind) {
  if (kind === "manta") return { w: 70, h: 44 };
  if (kind === "brute") return { w: 68, h: 76 };
  return { w: 40, h: 56 };
}

export function loadArt(): Promise<Art> {
  const names = ["player", "dart", "manta", "brute", "pickups", "bolt", "ebolt", "muzzle", "boom"] as const;
  const art = {
    player: null,
    dart: null,
    manta: null,
    brute: null,
    pickups: null,
    bolt: null,
    ebolt: null,
    muzzle: null,
    boom: null,
  } as Art;
  return Promise.all(
    names.map(
      (name) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => {
            art[name] = img;
            resolve();
          };
          img.onerror = () => resolve();
          img.src = `/sprites/${name}.png`;
        }),
    ),
  ).then(() => art);
}
