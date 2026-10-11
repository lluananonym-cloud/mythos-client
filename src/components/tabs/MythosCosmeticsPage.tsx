import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "../ui/buttons/Button";
import { Input } from "../ui/Input";
import { TabHeader } from "../ui/TabHeader";
import {
  createCape,
  deleteCosmetic,
  equipCape,
  listCosmetics,
  type MythosCosmetic,
  type MythosProfile,
} from "../../services/mythos-api";

// Cape-Texturen sind 64x32 pro Bild (oder ein Vielfaches). Die Vorderseite liegt bei x=1, y=1, 10x16.
const FRAME_W = 64;
const FRAME_H = 32;

type Animation = "none" | "pulse" | "rainbow" | "stripes";

/** Zeigt die Vorderseite einer Cape-Textur, bei mehreren Bildern animiert. */
function CapePreview({ src, frames, frameTimeMs, size = 6 }: { src: string; frames: number; frameTimeMs: number; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const img = new Image();
    let frame = 0;
    let timer: number | undefined;
    const draw = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx || !img.width) return;
      const scale = img.width / FRAME_W;
      const frameH = FRAME_H * scale;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 1 * scale, frame * frameH + 1 * scale, 10 * scale, 16 * scale, 0, 0, canvas.width, canvas.height);
      frame = (frame + 1) % Math.max(1, frames);
    };
    img.onload = () => {
      draw();
      if (frames > 1) timer = window.setInterval(draw, frameTimeMs);
    };
    img.src = src;
    return () => window.clearInterval(timer);
  }, [src, frames, frameTimeMs]);

  return <canvas ref={canvasRef} width={10 * size} height={16 * size} className="rounded bg-black/30" style={{ imageRendering: "pixelated" }} />;
}

/** Baut eine einfache (animierte) Cape-Textur aus zwei Farben, als PNG-Data-URL. */
async function generateCape(colorA: string, colorB: string, animation: Animation, frames: number, withLogo: boolean): Promise<string> {
  const count = animation === "none" ? 1 : frames;
  const canvas = document.createElement("canvas");
  canvas.width = FRAME_W;
  canvas.height = FRAME_H * count;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;

  let logo: HTMLImageElement | null = null;
  if (withLogo) {
    logo = await new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = "/logo.png";
    });
  }

  const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const mix = (t: number) => {
    const a = hex(colorA);
    const b = hex(colorB);
    return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(",")})`;
  };

  for (let f = 0; f < count; f++) {
    const y0 = f * FRAME_H;
    const t = count > 1 ? f / count : 0;
    let fill: string;
    if (animation === "pulse") fill = mix((1 - Math.cos(t * Math.PI * 2)) / 2);
    else if (animation === "rainbow") fill = `hsl(${Math.round(t * 360)}, 80%, 55%)`;
    else fill = colorA;
    ctx.fillStyle = fill;
    ctx.fillRect(0, y0, FRAME_W, FRAME_H);

    if (animation === "stripes") {
      ctx.fillStyle = colorB;
      const offset = Math.round(t * 8);
      for (let y = -8; y < 17; y += 8) ctx.fillRect(1, y0 + 1 + y + offset, 10, 3);
      for (let y = -8; y < 17; y += 8) ctx.fillRect(12, y0 + 1 + y + offset, 10, 3);
      ctx.clearRect(0, y0 - 1, FRAME_W, 1);
    } else if (animation === "none") {
      ctx.fillStyle = colorB;
      ctx.fillRect(1, y0 + 1, 10, 1);
      ctx.fillRect(1, y0 + 16, 10, 1);
    }
    if (logo) ctx.drawImage(logo, 2, y0 + 5, 8, 8);
  }
  return canvas.toDataURL("image/png");
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function imageSize(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = () => reject(new Error("Bild konnte nicht gelesen werden"));
    img.src = src;
  });
}

function CapeEditor({ onCreated }: { onCreated: () => void }) {
  const [mode, setMode] = useState<"generate" | "upload">("generate");
  const [name, setName] = useState("");
  const [colorA, setColorA] = useState("#1e1b4b");
  const [colorB, setColorB] = useState("#a855f7");
  const [animation, setAnimation] = useState<Animation>("pulse");
  const [withLogo, setWithLogo] = useState(true);
  const [frames, setFrames] = useState(8);
  const [frameTimeMs, setFrameTimeMs] = useState(100);
  const [plusOnly, setPlusOnly] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (mode !== "generate") return;
    generateCape(colorA, colorB, animation, frames, withLogo).then(setImage);
  }, [mode, colorA, colorB, animation, frames, withLogo]);

  const onFile = async (file: File | undefined) => {
    setError(null);
    if (!file) return;
    const data = await readFile(file);
    const { width, height } = await imageSize(data);
    const frameHeight = width / 2;
    if (width < FRAME_W || width % FRAME_W !== 0 || height % frameHeight !== 0) {
      setError(`Das Bild ist ${width}x${height}. Ein Bild muss 64x32 sein (oder 128x64 usw.), mehrere Bilder untereinander.`);
      setImage(null);
      return;
    }
    setFrames(height / frameHeight);
    setImage(data);
  };

  const effectiveFrames = mode === "generate" && animation === "none" ? 1 : frames;

  const save = async () => {
    if (!image) return;
    setSaving(true);
    try {
      await createCape({ name: name.trim(), imageBase64: image, frames: effectiveFrames, frameTimeMs, plusOnly });
      toast.success("Cape erstellt!");
      setName("");
      onCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const selectClass = "bg-black/30 border border-white/20 rounded px-3 py-2 text-white";

  return (
    <div className="flex flex-col md:flex-row gap-6 p-4 rounded-lg border border-white/10 bg-black/20">
      <div className="flex flex-col gap-3 flex-1">
        <h2 className="font-minecraft text-2xl lowercase">neues cape erstellen</h2>
        <div className="flex gap-2">
          <Button size="sm" variant={mode === "generate" ? "default" : "ghost"} onClick={() => setMode("generate")}>Selbst machen</Button>
          <Button size="sm" variant={mode === "upload" ? "default" : "ghost"} onClick={() => setMode("upload")}>Bild hochladen</Button>
        </div>
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
        {mode === "generate" ? (
          <>
            <div className="flex gap-4 font-minecraft-ten text-sm">
              <label className="flex items-center gap-2">Farbe 1 <input type="color" value={colorA} onChange={(e) => setColorA(e.target.value)} /></label>
              <label className="flex items-center gap-2">Farbe 2 <input type="color" value={colorB} onChange={(e) => setColorB(e.target.value)} /></label>
            </div>
            <label className="flex flex-col gap-1 font-minecraft-ten text-sm">
              Animation
              <select className={selectClass} value={animation} onChange={(e) => setAnimation(e.target.value as Animation)}>
                <option value="none">Keine</option>
                <option value="pulse">Pulsieren</option>
                <option value="rainbow">Regenbogen</option>
                <option value="stripes">Laufende Streifen</option>
              </select>
            </label>
            {animation !== "none" && (
              <label className="flex flex-col gap-1 font-minecraft-ten text-sm">
                Bilder: {frames}
                <input type="range" min={2} max={32} value={frames} onChange={(e) => setFrames(Number(e.target.value))} />
              </label>
            )}
            <label className="flex items-center gap-2 font-minecraft-ten text-sm">
              <input type="checkbox" checked={withLogo} onChange={(e) => setWithLogo(e.target.checked)} /> Mythoscraft-Logo drauf
            </label>
          </>
        ) : (
          <label className="flex flex-col gap-1 font-minecraft-ten text-sm">
            PNG (64x32 pro Bild, für Animation Bilder untereinander)
            <input type="file" accept="image/png" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
        )}
        {effectiveFrames > 1 && (
          <label className="flex flex-col gap-1 font-minecraft-ten text-sm">
            Geschwindigkeit: {frameTimeMs} ms pro Bild
            <input type="range" min={20} max={1000} step={10} value={frameTimeMs} onChange={(e) => setFrameTimeMs(Number(e.target.value))} />
          </label>
        )}
        <label className="flex items-center gap-2 font-minecraft-ten text-sm">
          <input type="checkbox" checked={plusOnly} onChange={(e) => setPlusOnly(e.target.checked)} /> Nur für Plus
        </label>
        {error && <p className="font-minecraft-ten text-sm text-red-400">{error}</p>}
        <Button onClick={save} disabled={saving || !image || !name.trim()}>
          {saving ? "Wird gespeichert..." : "Cape erstellen"}
        </Button>
      </div>
      <div className="flex flex-col items-center gap-2">
        {image ? <CapePreview src={image} frames={effectiveFrames} frameTimeMs={frameTimeMs} size={12} /> : <div className="w-[120px] h-[192px] rounded bg-black/30" />}
        <span className="font-minecraft-ten text-xs text-white/60">Vorschau</span>
      </div>
    </div>
  );
}

/** Mythos Cosmetics: Capes ansehen und anlegen; der Owner kann neue Capes erstellen. */
export function MythosCosmeticsPage() {
  const [cosmetics, setCosmetics] = useState<MythosCosmetic[]>([]);
  const [profile, setProfile] = useState<MythosProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listCosmetics();
      setCosmetics(res.cosmetics);
      setProfile(res.profile);
      setProblem(res.loginError);
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const equip = async (id: string | null) => {
    setBusy(id ?? "none");
    try {
      setProfile(await equipCape(id));
      toast.success(id ? "Cape angelegt. Im Spiel siehst du es nach dem nächsten Start." : "Cape abgelegt.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const remove = async (id: string) => {
    setBusy(id);
    try {
      await deleteCosmetic(id);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TabHeader title="Cosmetics" icon="solar:magic-stick-3-bold" />
      <div className="flex-1 overflow-y-auto p-6 text-white flex flex-col gap-6">
        {profile && (
          <p className="font-minecraft-ten text-sm text-white/70">
            {profile.name} · {profile.coins} Coins{profile.plus ? " · Plus" : ""}
          </p>
        )}
        {loading && <p className="font-minecraft-ten text-sm text-white/60">Lade Cosmetics...</p>}
        {!loading && problem && (
          <div className="flex items-center gap-3 rounded-lg border border-red-400/40 bg-red-500/10 p-3">
            <p className="font-minecraft-ten text-sm text-red-300 flex-1">{problem}</p>
            <Button size="sm" onClick={() => void load()}>Nochmal</Button>
          </div>
        )}
        {profile?.owner && <CapeEditor onCreated={load} />}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4">
          {cosmetics.map((c) => {
            const equipped = profile?.equippedCape === c.id;
            const locked = c.plusOnly && !profile?.plus;
            return (
              <div key={c.id} className={`flex flex-col items-center gap-2 p-3 rounded-lg border ${equipped ? "border-purple-400" : "border-white/10"} bg-black/20`}>
                <CapePreview src={c.url} frames={c.frames} frameTimeMs={c.frameTimeMs} />
                <span className="font-minecraft text-xl lowercase text-center">{c.name}</span>
                {c.plusOnly && <span className="font-minecraft-ten text-xs text-yellow-300">Plus</span>}
                <Button
                  size="sm"
                  disabled={!profile || locked || busy !== null}
                  onClick={() => equip(equipped ? null : c.id)}
                >
                  {equipped ? "Ablegen" : locked ? "Nur Plus" : "Anlegen"}
                </Button>
                {profile?.owner && (
                  <Button size="sm" variant="destructive" disabled={busy !== null} onClick={() => remove(c.id)}>
                    Löschen
                  </Button>
                )}
              </div>
            );
          })}
        </div>
        {!loading && cosmetics.length === 0 && (
          <p className="font-minecraft-ten text-sm text-white/60">Noch keine Capes da.</p>
        )}
      </div>
    </div>
  );
}
