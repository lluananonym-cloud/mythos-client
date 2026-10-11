// Mythos: Ersatz für @noriskclient/nrc-skin-renderer, aufgebaut auf skinview3d (MIT).
export type {
  CosmeticAssetUrls,
  EmoteAssetUrls,
  NametagOptions,
  ParticleAssetEntry,
  SkinVariant,
} from "./core";
export type { PromoOutlineConfig } from "./postfx";
export { renderFlatSkin, type FlatSkinOptions } from "./flat";

export interface WebGLSupport {
  available: boolean;
  webgl2: boolean;
  reason?: string;
}

let support: WebGLSupport | null = null;

export function getWebGLSupport(): WebGLSupport {
  if (support) return support;
  if (typeof document === "undefined") return { available: false, webgl2: false, reason: "kein DOM" };
  try {
    const canvas = document.createElement("canvas");
    const gl2 = canvas.getContext("webgl2");
    const gl = gl2 ?? canvas.getContext("webgl") ?? canvas.getContext("experimental-webgl");
    if (!gl) {
      support = { available: false, webgl2: false, reason: "WebGL-Kontext nicht verfügbar" };
    } else {
      support = { available: true, webgl2: !!gl2 };
      (gl as WebGLRenderingContext).getExtension("WEBGL_lose_context")?.loseContext();
    }
  } catch (error) {
    support = { available: false, webgl2: false, reason: String(error) };
  }
  return support;
}

export function isWebGLAvailable(): boolean {
  return getWebGLSupport().available;
}
