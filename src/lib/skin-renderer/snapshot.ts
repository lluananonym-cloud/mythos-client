// Mythos: Standbilder des 3D-Spielers (Skin-Liste, Startseite ohne Animation) mit skinview3d.
import { SkinViewer } from "skinview3d";
import type { Sprite } from "three";

import {
  CAMERA_FOV,
  DEFAULT_YAW,
  applyEmotePose,
  capeTextureOf,
  createNametag,
  disposeNametag,
  disposeViewer,
  frameRig,
  frameToFit,
  loadEmoteClip,
  loadImage,
  resetPose,
  setNametag,
  skinModelOf,
  updateNametagPosition,
  type EmoteAssetUrls,
  type NametagOptions,
  type RendererCosmetic,
  type SkinVariant,
} from "./core";

export type { NametagOptions } from "./core";

export type SnapshotCosmetic = RendererCosmetic;

export interface SkinSnapshotRequest {
  textureUrl: string;
  variant?: SkinVariant;
  cosmetics?: SnapshotCosmetic[];
  cape?: { texture?: string | null; elytra?: boolean } | null;
  nametag?: NametagOptions | null;
  emote?: EmoteAssetUrls | null;
  // Zeitpunkt (Sekunden) im Emote, dessen Pose eingefroren wird.
  emoteTime?: number;
  // Gierwinkel des Spielers in Radiant.
  rotation?: number;
  // true/Zahl: Spieler bildfüllend einrahmen (Zahl = Randfaktor); false: feste Rig-Aufteilung.
  fit?: boolean | number;
  // true/Zahl: transparente Ränder abschneiden (Zahl = Innenabstand relativ zur Bildgröße).
  crop?: boolean | number;
}

export interface SnapshotOptions {
  mimeType?: string;
  quality?: number;
}

function cropToContent(source: HTMLCanvasElement, padding: number): HTMLCanvasElement {
  const { width, height } = source;
  const scan = document.createElement("canvas");
  scan.width = width;
  scan.height = height;
  const ctx = scan.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(source, 0, 0);
  const data = ctx.getImageData(0, 0, width, height).data;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return scan;

  const pad = Math.round(Math.max(width, height) * padding);
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);

  const out = document.createElement("canvas");
  out.width = maxX - minX + 1;
  out.height = maxY - minY + 1;
  out.getContext("2d")!.drawImage(scan, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

function toBlob(canvas: HTMLCanvasElement, options: SnapshotOptions): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Snapshot konnte nicht erzeugt werden"))),
      options.mimeType ?? "image/png",
      options.quality,
    );
  });
}

export class SkinSnapshotRenderer {
  private readonly viewer: SkinViewer;
  private nametag: Sprite | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(width: number, height: number) {
    this.viewer = new SkinViewer({
      canvas: document.createElement("canvas"),
      width,
      height,
      pixelRatio: 1,
      fov: CAMERA_FOV,
      renderPaused: true,
      preserveDrawingBuffer: true,
      enableControls: false,
    });
  }

  // Aufträge laufen nacheinander, da sich alle denselben Viewer teilen.
  snapshot(request: SkinSnapshotRequest, options: SnapshotOptions = {}): Promise<Blob> {
    const run = this.queue.then(() => this.render(request, options));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async render(request: SkinSnapshotRequest, options: SnapshotOptions): Promise<Blob> {
    const viewer = this.viewer;
    const player = viewer.playerObject;
    viewer.animation = null;
    resetPose(player);

    const skin = await loadImage(request.textureUrl);
    viewer.loadSkin(skin, { model: skinModelOf(request.variant) });

    const capeUrl = request.cape?.texture ?? capeTextureOf(request.cosmetics);
    const cape = capeUrl ? await loadImage(capeUrl).catch(() => null) : null;
    if (cape) {
      viewer.loadCape(cape, { backEquipment: request.cape?.elytra ? "elytra" : "cape" });
    } else {
      viewer.loadCape(null);
    }

    disposeNametag(this.nametag);
    this.nametag = request.nametag?.text ? await createNametag(request.nametag) : null;
    setNametag(viewer, this.nametag);

    if (request.emote?.animation) {
      const clip = await loadEmoteClip(request.emote.animation).catch(() => null);
      if (clip) applyEmotePose(player, clip, Math.min(request.emoteTime ?? 0, clip.length));
    }
    updateNametagPosition(this.nametag, player);
    viewer.playerWrapper.rotation.y = request.rotation ?? DEFAULT_YAW;

    const fit = request.fit ?? true;
    if (fit === false) frameRig(viewer);
    else frameToFit(viewer, fit === true ? 1 : fit);

    viewer.render();

    const crop = request.crop ?? false;
    const output = crop === false ? viewer.canvas : cropToContent(viewer.canvas, crop === true ? 0.02 : crop);
    return toBlob(output, options);
  }

  dispose(): void {
    disposeNametag(this.nametag);
    this.nametag = null;
    disposeViewer(this.viewer);
  }
}
