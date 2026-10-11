// Mythos: React-Komponenten des Skin-Renderers (3D-Viewer mit skinview3d, 2D-Fallback).
import React, { useEffect, useRef, useState } from "react";
import { FunctionAnimation, IdleAnimation, SkinViewer } from "skinview3d";
import type { Sprite } from "three";

import {
  CAMERA_FOV,
  DEFAULT_YAW,
  applyEmotePose,
  capeTextureOf,
  createNametag,
  disposeNametag,
  disposeViewer,
  emoteTime,
  frameRig,
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
import { renderFlatSkin } from "./flat";
import type { PromoOutlineConfig } from "./postfx";

export interface SkinRendererProps {
  textureUrl: string | null | undefined;
  variant?: SkinVariant;
  cape?: { texture?: string | null; elytra?: boolean } | null;
  // Nur Capes (type "CAPE") werden dargestellt, GeckoLib-Cosmetics sind No-ops.
  cosmetics?: RendererCosmetic[];
  emote?: EmoteAssetUrls | null;
  emoteLoop?: boolean;
  onEmoteEnd?: () => void;
  nametag?: NametagOptions | null;
  // Ohne zoom gilt die feste Rig-Aufteilung der Startseite, sonst 1 ≈ ganzer Spieler knapp.
  zoom?: number;
  rotation?: number;
  draggable?: boolean;
  dragAxis?: "yaw" | "both";
  loading?: boolean;
  paused?: boolean;
  fps?: number;
  maxDpr?: number;
  // No-ops (nur im NoRisk-Renderer vorhanden):
  outline?: Partial<PromoOutlineConfig>;
  skeletonColor?: string;
  className?: string;
  style?: React.CSSProperties;
}

// Abbildung der NoRisk-Zoomwerte (1.5-1.75 = ganzer Spieler) auf skinview3d (0.9 = Standard).
function viewerZoom(zoom: number): number {
  return Math.min(1.2, Math.max(0.3, zoom * 0.5));
}

export function SkinRenderer({
  textureUrl,
  variant,
  cape,
  cosmetics,
  emote,
  emoteLoop = true,
  onEmoteEnd,
  nametag,
  zoom,
  rotation,
  draggable,
  dragAxis,
  loading = false,
  paused = false,
  fps = 60,
  maxDpr = 2,
  className,
  style,
}: SkinRendererProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<SkinViewer | null>(null);
  const nametagRef = useRef<Sprite | null>(null);
  const settingsRef = useRef({ paused, fps });
  settingsRef.current = { paused, fps };
  const onEmoteEndRef = useRef(onEmoteEnd);
  onEmoteEndRef.current = onEmoteEnd;
  const [viewer, setViewer] = useState<SkinViewer | null>(null);

  // Viewer anlegen; die eigene Schleife begrenzt die Bildrate und hält bei `paused` an.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const canvas = document.createElement("canvas");
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    host.appendChild(canvas);

    const instance = new SkinViewer({
      canvas,
      width: Math.max(1, host.clientWidth),
      height: Math.max(1, host.clientHeight),
      pixelRatio: Math.min(window.devicePixelRatio || 1, maxDpr),
      fov: CAMERA_FOV,
      renderPaused: true,
    });
    instance.controls.enableZoom = false;
    instance.animation = new IdleAnimation();
    viewerRef.current = instance;
    setViewer(instance);

    const resize = new ResizeObserver(() => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (w > 0 && h > 0 && (w !== instance.width || h !== instance.height)) {
        instance.setSize(w, h);
        instance.render();
      }
    });
    resize.observe(host);

    let frame = 0;
    let last = performance.now();
    let pending = 0;
    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      const { paused: isPaused, fps: limit } = settingsRef.current;
      const dt = (now - last) / 1000;
      last = now;
      if (isPaused) return;
      pending += dt;
      if (limit > 0 && pending < 1 / limit - 0.002) return;
      const step = Math.min(pending, 0.1);
      pending = 0;
      instance.animation?.update(instance.playerObject, step);
      updateNametagPosition(nametagRef.current, instance.playerObject);
      instance.controls.update();
      instance.render();
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      disposeNametag(nametagRef.current);
      nametagRef.current = null;
      viewerRef.current = null;
      disposeViewer(instance);
      canvas.remove();
    };
  }, [maxDpr]);

  // Skin
  useEffect(() => {
    if (!viewer) return;
    let alive = true;
    if (!textureUrl) {
      viewer.loadSkin(null);
      return;
    }
    loadImage(textureUrl)
      .then((img) => {
        if (alive && !viewer.disposed) viewer.loadSkin(img, { model: skinModelOf(variant) });
      })
      .catch((error) => console.warn("[SkinRenderer]", error));
    return () => {
      alive = false;
    };
  }, [viewer, textureUrl, variant]);

  // Cape bzw. Elytra (aus `cape` oder einem Cape-Cosmetic)
  const capeUrl = cape?.texture ?? capeTextureOf(cosmetics);
  const elytra = !!cape?.elytra;
  useEffect(() => {
    if (!viewer) return;
    let alive = true;
    if (!capeUrl) {
      viewer.loadCape(null);
      return;
    }
    loadImage(capeUrl)
      .then((img) => {
        if (alive && !viewer.disposed) {
          viewer.loadCape(img, { backEquipment: elytra ? "elytra" : "cape" });
        }
      })
      .catch((error) => console.warn("[SkinRenderer]", error));
    return () => {
      alive = false;
    };
  }, [viewer, capeUrl, elytra]);

  // Namensschild
  const tagText = nametag?.text ?? "";
  const tagIcon = nametag?.iconUrl ?? "";
  useEffect(() => {
    if (!viewer) return;
    let alive = true;
    const replace = (sprite: Sprite | null) => {
      disposeNametag(nametagRef.current);
      nametagRef.current = sprite;
      setNametag(viewer, sprite);
      updateNametagPosition(sprite, viewer.playerObject);
    };
    if (!tagText) {
      replace(null);
      return;
    }
    createNametag({ text: tagText, iconUrl: tagIcon || null })
      .then((sprite) => {
        if (alive && !viewer.disposed) replace(sprite);
        else disposeNametag(sprite);
      })
      .catch((error) => console.warn("[SkinRenderer]", error));
    return () => {
      alive = false;
    };
  }, [viewer, tagText, tagIcon]);

  // Emote (Bedrock-Animation) oder ruhige Standard-Idle-Animation
  const emoteUrl = emote?.animation ?? null;
  useEffect(() => {
    if (!viewer) return;
    let alive = true;
    const idle = () => {
      resetPose(viewer.playerObject);
      viewer.animation = new IdleAnimation();
    };
    if (!emoteUrl) {
      idle();
      return;
    }
    loadEmoteClip(emoteUrl)
      .then((clip) => {
        if (!alive || viewer.disposed) return;
        let ended = false;
        resetPose(viewer.playerObject);
        viewer.animation = new FunctionAnimation((player, progress) => {
          applyEmotePose(player, clip, emoteTime(clip, progress, emoteLoop));
          if (!emoteLoop && !ended && progress >= clip.length) {
            ended = true;
            onEmoteEndRef.current?.();
          }
        });
      })
      .catch((error) => {
        console.warn("[SkinRenderer]", error);
        if (alive && !viewer.disposed) idle();
      });
    return () => {
      alive = false;
    };
  }, [viewer, emoteUrl, emoteLoop]);

  // Kamera, Drehung und Steuerung
  useEffect(() => {
    if (!viewer) return;
    viewer.playerWrapper.rotation.y = rotation ?? DEFAULT_YAW;
    if (zoom === undefined) {
      frameRig(viewer);
    } else {
      viewer.controls.target.set(0, 0, 0);
      viewer.camera.position.set(0, 0, 1);
      viewer.zoom = viewerZoom(zoom);
    }
    const controls = viewer.controls;
    controls.enableRotate = draggable ?? !!dragAxis;
    if (dragAxis === "yaw") {
      controls.minPolarAngle = Math.PI / 2;
      controls.maxPolarAngle = Math.PI / 2;
    } else {
      controls.minPolarAngle = 0;
      controls.maxPolarAngle = Math.PI;
    }
    controls.update();
  }, [viewer, zoom, rotation, draggable, dragAxis]);

  // Während des Ladens bleibt der Spieler ausgeblendet.
  useEffect(() => {
    if (!viewer) return;
    viewer.playerWrapper.visible = !loading;
  }, [viewer, loading]);

  return (
    <div
      ref={hostRef}
      className={className}
      style={{
        position: "relative",
        overflow: "hidden",
        cursor: (draggable ?? !!dragAxis) ? "grab" : undefined,
        ...style,
      }}
    />
  );
}

export interface FlatSkinProps {
  textureUrl: string | null | undefined;
  variant?: SkinVariant;
  className?: string;
  style?: React.CSSProperties;
}

export function FlatSkin({ textureUrl, variant, className, style }: FlatSkinProps) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setUrl(null);
    if (!textureUrl) return;
    renderFlatSkin(textureUrl, { variant })
      .then((result) => alive && setUrl(result))
      .catch((error) => console.warn("[FlatSkin]", error));
    return () => {
      alive = false;
    };
  }, [textureUrl, variant]);

  if (!url) return null;
  return (
    <img
      src={url}
      alt="Skin"
      draggable={false}
      className={className}
      style={{
        width: "100%",
        height: "100%",
        objectFit: "contain",
        imageRendering: "pixelated",
        userSelect: "none",
        ...style,
      }}
    />
  );
}
