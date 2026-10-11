// Mythos: eigener Skin-Renderer auf Basis von skinview3d (MIT) als Ersatz für das
// lizenzlose @noriskclient/nrc-skin-renderer. Dieses Modul enthält die gemeinsamen
// Typen und Hilfsfunktionen für den 3D-Viewer (react.tsx) und die Standbilder (snapshot.ts).

import {
  CanvasTexture,
  LinearFilter,
  SRGBColorSpace,
  Sprite,
  SpriteMaterial,
  Vector3,
} from "three";
import type { PlayerObject, SkinViewer } from "skinview3d";

export type SkinVariant = "classic" | "slim" | "auto";

// GeckoLib-Partikel der NoRisk-Cosmetics. Werden nur noch durchgereicht, aber nicht gerendert.
export interface ParticleAssetEntry {
  jsonUrl: string;
  resolveTexture: (ref: string) => string;
}

// Assets eines Cosmetics. Gerendert wird davon nur die Textur von Capes (type "CAPE");
// GeckoLib-Modelle (.geo.json), Animationen und Partikel sind ohne den NoRisk-Renderer No-ops.
export interface CosmeticAssetUrls {
  geo: string;
  texture: string;
  animation?: string;
  mcmeta?: string;
  metadataJson?: unknown;
  particles?: ParticleAssetEntry[];
}

// Emote im Bedrock-/GeckoLib-Animationsformat (.animation.json). Abgespielt werden
// Rotation, Position und Skalierung der Körperteile; eigene Emote-Modelle (geo/texture) nicht.
export interface EmoteAssetUrls {
  animation: string;
  geo?: string;
  texture?: string;
  mcmeta?: string;
}

export interface NametagOptions {
  text: string;
  iconUrl?: string | null;
  iconPlus?: boolean;
}

export interface RendererCosmetic {
  id: string;
  type?: string;
  urls: CosmeticAssetUrls;
}

export const CAMERA_FOV = 40;
// Leichte Schrägansicht, wenn kein Winkel vorgegeben ist.
export const DEFAULT_YAW = -0.35;
// Feste Bildaufteilung ohne "fit": so viele Welteinheiten (1 Einheit = 1 Skin-Pixel) zeigt
// das Bild in der Höhe, zentriert knapp über der Körpermitte (Platz für das Namensschild).
const RIG_VISIBLE_HEIGHT = 78;
const RIG_TARGET_Y = 2.5;
const NAMETAG_Y = 20;
const NAMETAG_HEIGHT = 3;
const NAMETAG_FONT_PX = 48;

export function skinModelOf(variant: SkinVariant | string | undefined): "default" | "slim" | "auto-detect" {
  if (variant === "slim") return "slim";
  if (variant === "classic" || variant === "default") return "default";
  return "auto-detect";
}

export function capeTextureOf(cosmetics: readonly RendererCosmetic[] | undefined): string | null {
  const cape = cosmetics?.find((c) => c.type?.toUpperCase() === "CAPE" && c.urls?.texture);
  return cape?.urls.texture ?? null;
}

const imageCache = new Map<string, Promise<HTMLImageElement>>();

export function loadImage(url: string): Promise<HTMLImageElement> {
  let pending = imageCache.get(url);
  if (!pending) {
    pending = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.decoding = "async";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Bild konnte nicht geladen werden: ${url.slice(0, 120)}`));
      img.src = url;
    });
    pending.catch(() => imageCache.delete(url));
    // Data-URLs (z. B. Upload-Vorschauen) nicht dauerhaft festhalten.
    if (!url.startsWith("data:")) imageCache.set(url, pending);
    if (imageCache.size > 64) imageCache.delete(imageCache.keys().next().value!);
  }
  return pending;
}

// skinview3d ist für three r156 gebaut, die App bündelt per Vite-dedupe aber nur r176.
// Dort heißt ShaderPass.fsQuad intern _fsQuad, SkinViewer.dispose() würde sonst werfen.
export function disposeViewer(viewer: SkinViewer): void {
  const pass = viewer.fxaaPass as unknown as { fsQuad?: unknown; _fsQuad?: unknown };
  if (!pass.fsQuad && pass._fsQuad) pass.fsQuad = pass._fsQuad;
  viewer.dispose();
}

// --- Namensschild -------------------------------------------------------------------------

export async function createNametag(options: NametagOptions): Promise<Sprite> {
  const font = `${NAMETAG_FONT_PX}px MinecraftTen, Outfit, sans-serif`;
  try {
    await document.fonts?.load(font, options.text);
  } catch {
    /* Schrift optional */
  }
  const icon = options.iconUrl ? await loadImage(options.iconUrl).catch(() => null) : null;

  const pad = 12;
  const gap = 10;
  const lineHeight = Math.round(NAMETAG_FONT_PX * 1.25);
  const measure = document.createElement("canvas").getContext("2d")!;
  measure.font = font;
  const textWidth = Math.ceil(measure.measureText(options.text).width);
  const iconSize = icon ? lineHeight : 0;

  const canvas = document.createElement("canvas");
  canvas.width = pad * 2 + iconSize + (icon ? gap : 0) + textWidth;
  canvas.height = pad * 2 + lineHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (icon) {
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(icon, pad, pad, iconSize, iconSize);
  }
  ctx.font = font;
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(options.text, pad + iconSize + (icon ? gap : 0), canvas.height / 2 + 2);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  const sprite = new Sprite(new SpriteMaterial({ map: texture, transparent: true }));
  sprite.scale.set((NAMETAG_HEIGHT * canvas.width) / canvas.height, NAMETAG_HEIGHT, 1);
  sprite.position.y = NAMETAG_Y;
  sprite.name = "nametag";
  return sprite;
}

export function disposeNametag(sprite: Sprite | null): void {
  if (!sprite) return;
  sprite.removeFromParent();
  sprite.material.map?.dispose();
  sprite.material.dispose();
}

// Das Schild folgt dem Kopf, wenn ein Emote ihn verschiebt.
export function updateNametagPosition(sprite: Sprite | null, player: PlayerObject): void {
  if (!sprite) return;
  const head = player.skin.head.position;
  sprite.position.set(head.x, NAMETAG_Y + head.y, head.z);
}

export function setNametag(viewer: SkinViewer, sprite: Sprite | null): void {
  if (sprite) viewer.playerWrapper.add(sprite as any);
}

// --- Kamera -------------------------------------------------------------------------------

// Feste Bildaufteilung (Startseiten-Rig): gleiche Größe im 3D-Viewer und im Standbild.
export function frameRig(viewer: SkinViewer): void {
  const fov = (viewer.camera.fov * Math.PI) / 180;
  const distance = RIG_VISIBLE_HEIGHT / 2 / Math.tan(fov / 2);
  viewer.camera.position.set(0, RIG_TARGET_Y, distance);
  viewer.controls.target.set(0, RIG_TARGET_Y, 0);
  viewer.camera.lookAt(0, RIG_TARGET_Y, 0);
  viewer.camera.updateProjectionMatrix();
}

// Rahmt alle sichtbaren Teile (Spieler, Cape, Namensschild) bildfüllend ein.
export function frameToFit(viewer: SkinViewer, margin: number): void {
  const wrapper = viewer.playerWrapper as any;
  wrapper.updateWorldMatrix(true, true);
  const min = new Vector3(Infinity, Infinity, Infinity);
  const max = new Vector3(-Infinity, -Infinity, -Infinity);
  const corner = new Vector3();
  wrapper.traverseVisible((obj: any) => {
    const geometry = obj.geometry;
    if (!geometry || !(obj.isMesh || obj.isSprite)) return;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    for (let i = 0; i < 8; i++) {
      corner
        .set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z)
        .applyMatrix4(obj.matrixWorld);
      min.min(corner);
      max.max(corner);
    }
  });
  if (!Number.isFinite(min.x)) {
    frameRig(viewer);
    return;
  }

  const center = min.clone().add(max).multiplyScalar(0.5);
  const size = max.clone().sub(min);
  const camera = viewer.camera;
  const tanV = Math.tan(((camera.fov * Math.PI) / 180) / 2);
  const tanH = tanV * camera.aspect;
  const distance =
    Math.max((size.y / 2) * margin / tanV, (size.x / 2) * margin / tanH) + size.z / 2;
  camera.position.set(center.x, center.y, center.z + distance);
  camera.lookAt(center.x, center.y, center.z);
  camera.updateProjectionMatrix();
}

// --- Emotes (Bedrock-Animationsformat) ---------------------------------------------------

type Vec3 = [number, number, number];

interface Keyframe {
  time: number;
  pre: Vec3;
  post: Vec3;
  smooth: boolean;
}

type Channel = Keyframe[];

interface BoneTrack {
  rotation?: Channel;
  position?: Channel;
  scale?: Channel;
}

export interface EmoteClip {
  length: number;
  loop: boolean;
  bones: Map<BonePart, BoneTrack>;
}

type BonePart = "head" | "body" | "rightArm" | "leftArm" | "rightLeg" | "leftLeg";

const BONE_NAMES: Record<string, BonePart> = {
  head: "head",
  body: "body",
  torso: "body",
  rightarm: "rightArm",
  leftarm: "leftArm",
  rightleg: "rightLeg",
  leftleg: "leftLeg",
};

function boneOf(name: string): BonePart | null {
  const key = name.toLowerCase().replace(/^biped/, "").replace(/[_\s-]/g, "");
  return BONE_NAMES[key] ?? null;
}

function toVec3(value: unknown, fallback: number): Vec3 | null {
  if (typeof value === "number") return [value, value, value];
  const raw = Array.isArray(value)
    ? value
    : value && typeof value === "object" && Array.isArray((value as { vector?: unknown }).vector)
      ? (value as { vector: unknown[] }).vector
      : null;
  if (!raw) return null;
  const num = (v: unknown) => {
    const n = typeof v === "number" ? v : Number.parseFloat(String(v));
    return Number.isFinite(n) ? n : fallback;
  };
  return [num(raw[0]), num(raw[1]), num(raw[2])];
}

function parseChannel(data: unknown, fallback: number): Channel | undefined {
  const constant = toVec3(data, fallback);
  if (constant) return [{ time: 0, pre: constant, post: constant, smooth: false }];
  if (!data || typeof data !== "object") return undefined;

  const frames: Keyframe[] = [];
  for (const [timeKey, frame] of Object.entries(data as Record<string, unknown>)) {
    const time = Number.parseFloat(timeKey);
    if (!Number.isFinite(time)) continue;
    const direct = toVec3(frame, fallback);
    if (direct) {
      frames.push({ time, pre: direct, post: direct, smooth: false });
      continue;
    }
    if (!frame || typeof frame !== "object") continue;
    const f = frame as { pre?: unknown; post?: unknown; lerp_mode?: unknown };
    const post = toVec3(f.post, fallback) ?? toVec3(f.pre, fallback);
    if (!post) continue;
    frames.push({
      time,
      pre: toVec3(f.pre, fallback) ?? post,
      post,
      smooth: f.lerp_mode === "catmullrom",
    });
  }
  frames.sort((a, b) => a.time - b.time);
  return frames.length > 0 ? frames : undefined;
}

function parseClip(json: unknown): EmoteClip | null {
  const animations = (json as { animations?: Record<string, unknown> })?.animations;
  if (!animations) return null;
  const first = Object.values(animations)[0] as
    | { loop?: unknown; animation_length?: unknown; bones?: Record<string, Record<string, unknown>> }
    | undefined;
  if (!first) return null;

  const bones = new Map<BonePart, BoneTrack>();
  let lastKey = 0;
  for (const [name, data] of Object.entries(first.bones ?? {})) {
    const part = boneOf(name);
    if (!part || !data) continue;
    const track: BoneTrack = {
      rotation: parseChannel(data.rotation, 0),
      position: parseChannel(data.position, 0),
      scale: parseChannel(data.scale, 1),
    };
    for (const ch of [track.rotation, track.position, track.scale]) {
      if (ch) lastKey = Math.max(lastKey, ch[ch.length - 1].time);
    }
    bones.set(part, track);
  }

  const length = Number(first.animation_length);
  return {
    length: Number.isFinite(length) && length > 0 ? length : lastKey,
    loop: first.loop === true || first.loop === "loop",
    bones,
  };
}

const clipCache = new Map<string, Promise<EmoteClip>>();

export function loadEmoteClip(url: string): Promise<EmoteClip> {
  let pending = clipCache.get(url);
  if (!pending) {
    pending = fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`Emote ${url}: HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        const clip = parseClip(json);
        if (!clip) throw new Error(`Emote ${url}: keine Animation gefunden`);
        return clip;
      });
    pending.catch(() => clipCache.delete(url));
    clipCache.set(url, pending);
  }
  return pending;
}

function catmull(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

function sample(channel: Channel, time: number): Vec3 {
  if (time <= channel[0].time) return channel[0].pre;
  const last = channel[channel.length - 1];
  if (time >= last.time) return last.post;

  let i = 0;
  while (i < channel.length - 2 && channel[i + 1].time <= time) i++;
  const k0 = channel[i];
  const k1 = channel[i + 1];
  const span = k1.time - k0.time;
  const t = span > 0 ? (time - k0.time) / span : 1;
  const a = k0.post;
  const b = k1.pre;

  if (k0.smooth || k1.smooth) {
    const before = channel[i - 1]?.post ?? a;
    const after = channel[i + 2]?.pre ?? b;
    return [0, 1, 2].map((n) => catmull(before[n], a[n], b[n], after[n], t)) as Vec3;
  }
  return [0, 1, 2].map((n) => a[n] + (b[n] - a[n]) * t) as Vec3;
}

const DEG = Math.PI / 180;
const BODY_OFFSET = new Vector3();

// Setzt die Pose für den Zeitpunkt `time` (Sekunden). Umrechnung Bedrock -> skinview3d:
// das Modell schaut in skinview3d nach +z, in Bedrock nach -z, daher x bleibt, y/z kehren sich um.
export function applyEmotePose(player: PlayerObject, clip: EmoteClip, time: number): void {
  const skin = player.skin;
  resetPose(player);
  for (const [part, track] of clip.bones) {
    const bone = skin[part];
    if (track.rotation) {
      const [x, y, z] = sample(track.rotation, time);
      bone.rotation.set(x * DEG, -y * DEG, -z * DEG);
    }
    if (part === "body") {
      // Bedrock dreht den Oberkörper um den Hals, skinview3d um seine Mitte.
      BODY_OFFSET.set(0, -6, 0).applyEuler(bone.rotation as any);
      bone.position.set(BODY_OFFSET.x, BODY_OFFSET.y, BODY_OFFSET.z);
    }
    if (track.position) {
      const [x, y, z] = sample(track.position, time);
      bone.position.x += x;
      bone.position.y += y;
      bone.position.z -= z;
    }
    if (track.scale) {
      const [x, y, z] = sample(track.scale, time);
      bone.scale.set(x, y, z);
    }
  }
  if (clip.bones.has("body")) attachBackEquipment(player);
}

const CAPE_ANCHOR = new Vector3();
const CAPE_DEFAULT_ANGLE = (10.8 * Math.PI) / 180;

// Cape und Elytra hängen am oberen Rücken und folgen dem Oberkörper.
function attachBackEquipment(player: PlayerObject): void {
  const body = player.skin.body;
  CAPE_ANCHOR.set(0, 6, -2)
    .applyEuler(body.rotation as any)
    .add(body.position as any);
  const y = CAPE_ANCHOR.y + player.skin.position.y;
  player.cape.position.set(CAPE_ANCHOR.x, y, CAPE_ANCHOR.z);
  player.cape.rotation.x = CAPE_DEFAULT_ANGLE + body.rotation.x;
  player.elytra.position.set(CAPE_ANCHOR.x, y, CAPE_ANCHOR.z);
  player.elytra.rotation.x = body.rotation.x;
}

const PARTS: BonePart[] = ["head", "body", "rightArm", "leftArm", "rightLeg", "leftLeg"];

// resetJoints() von skinview3d setzt keine Skalierung zurück.
export function resetPose(player: PlayerObject): void {
  player.resetJoints();
  for (const part of PARTS) player.skin[part].scale.set(1, 1, 1);
}

export function emoteTime(clip: EmoteClip, elapsed: number, loop: boolean): number {
  if (clip.length <= 0) return 0;
  return loop ? elapsed % clip.length : Math.min(elapsed, clip.length);
}
