// Mythos: 2D-Vorderansicht eines Skins (Fallback ohne WebGL), reines Canvas 2D.
import { loadImage, type SkinVariant } from "./core";

export interface FlatSkinOptions {
  variant?: SkinVariant;
  // Vergrößerung je Skin-Pixel.
  scale?: number;
}

type Rect = [sx: number, sy: number, w: number, h: number, dx: number, dy: number];

function isSlim(img: HTMLImageElement, variant: SkinVariant | undefined): boolean {
  if (variant === "slim") return true;
  if (variant === "classic" || img.height < img.width) return false;
  // "auto": bei schmalen Armen ist die Spalte x=54..55 im Armbereich transparent.
  const unit = img.width / 64;
  const probe = document.createElement("canvas");
  probe.width = img.width;
  probe.height = img.height;
  const ctx = probe.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(54 * unit, 20 * unit, 2 * unit, 12 * unit).data;
  for (let i = 3; i < data.length; i += 4) if (data[i] !== 0) return false;
  return true;
}

export async function renderFlatSkin(
  textureUrl: string,
  options: FlatSkinOptions = {},
): Promise<string> {
  const img = await loadImage(textureUrl);
  const unit = img.width / 64;
  const legacy = img.height < img.width; // 64x32-Skins ohne eigene linke Seite und Overlays
  const arm = isSlim(img, options.variant) ? 3 : 4;
  const scale = options.scale ?? 16;

  const canvas = document.createElement("canvas");
  canvas.width = 16 * scale;
  canvas.height = 32 * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;

  const draw = ([sx, sy, w, h, dx, dy]: Rect, mirror = false) => {
    ctx.save();
    if (mirror) {
      ctx.translate((dx + w) * scale, 0);
      ctx.scale(-1, 1);
      dx = 0;
    }
    ctx.drawImage(img, sx * unit, sy * unit, w * unit, h * unit, dx * scale, dy * scale, w * scale, h * scale);
    ctx.restore();
  };

  // Grundschicht
  draw([8, 8, 8, 8, 4, 0]); // Kopf
  draw([20, 20, 8, 12, 4, 8]); // Körper
  draw([44, 20, arm, 12, 4 - arm, 8]); // rechter Arm (links im Bild)
  draw([4, 20, 4, 12, 4, 20]); // rechtes Bein
  if (legacy) {
    draw([44, 20, arm, 12, 12, 8], true);
    draw([4, 20, 4, 12, 8, 20], true);
  } else {
    draw([36, 52, arm, 12, 12, 8]); // linker Arm
    draw([20, 52, 4, 12, 8, 20]); // linkes Bein
  }

  // Zweite Schicht
  draw([40, 8, 8, 8, 4, 0]); // Hut
  if (!legacy) {
    draw([20, 36, 8, 12, 4, 8]);
    draw([44, 36, arm, 12, 4 - arm, 8]);
    draw([52, 52, arm, 12, 12, 8]);
    draw([4, 36, 4, 12, 4, 20]);
    draw([4, 52, 4, 12, 8, 20]);
  }

  return canvas.toDataURL("image/png");
}
