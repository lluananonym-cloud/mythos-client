// Mythos-Backend (Supabase Edge Function "mcc"): Plus, Währung, Cosmetics und Creator-Bewerbungen.
import { invoke } from "@tauri-apps/api/core";

export interface MythosProfile {
  uuid: string;
  name: string;
  plus: boolean;
  coins: number;
  owner: boolean;
  creator: boolean;
  creatorCode: string | null;
  equippedCape: string | null;
}

export interface MythosCosmetic {
  id: string;
  name: string;
  type: "cape";
  url: string;
  frames: number;
  frameTimeMs: number;
  plusOnly: boolean;
}

export interface CreatorApplication {
  mcName: string;
  discord: string;
  platform: string;
  channelUrl: string;
  followers: number;
  message: string;
}

let session: { token: string; profile: MythosProfile } | null = null;

/** Macht aus Tauri-Fehlern ({ message }) und Error-Objekten einen lesbaren Text. */
export function mythosErrorText(e: unknown): string {
  const raw =
    e instanceof Error ? e.message
    : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message)
    : String(e);
  return raw.replace(/^Account error:\s*/, "");
}

async function call<T>(action: string, body: Record<string, unknown> = {}, token?: string): Promise<T> {
  try {
    // Läuft über Rust (Command mythos_api), damit CORS im Webview keine Rolle spielt.
    return await invoke<T>("mythos_api", { action, body, token: token ?? null });
  } catch (e) {
    throw new Error(mythosErrorText(e));
  }
}

/** Meldet das aktive Minecraft-Konto beim Mythos-Backend an (einmal pro Launcher-Start). */
export async function mythosLogin(force = false): Promise<{ token: string; profile: MythosProfile }> {
  if (session && !force) return session;
  const res = await invoke<{ token: string; profile: MythosProfile }>("mythos_login").catch((e) => {
    throw new Error(mythosErrorText(e));
  });
  session = { token: res.token, profile: res.profile };
  return session;
}

export const submitCreatorApplication = (application: CreatorApplication) =>
  call<{ ok: true }>("creator-apply", { ...application });

/** Holt die Abonnenten/Follower eines Kanals live (YouTube, TikTok, Twitch). */
export const fetchChannelStats = (url: string) =>
  call<{ platform: string; followers: number; name: string | null }>("channel-stats", { url });

export interface CreatorInfo {
  code: string | null;
  supporters: number;
  supporting: { code: string; name: string } | null;
}

export async function getCreatorInfo(): Promise<CreatorInfo> {
  const s = await mythosLogin();
  return call<CreatorInfo>("creator-info", {}, s.token);
}

export async function setCreatorCode(code: string): Promise<string> {
  const s = await mythosLogin();
  const res = await call<{ code: string }>("creator-code", { code }, s.token);
  return res.code;
}

/** Creator-Code eintragen (null = keinen Creator mehr unterstützen). */
export async function supportCreator(code: string | null): Promise<CreatorInfo["supporting"]> {
  const s = await mythosLogin();
  const res = await call<{ supporting: CreatorInfo["supporting"] }>("support", { code }, s.token);
  return res.supporting;
}

/** Eigenes Mythos-Profil (meldet bei Bedarf an). */
export async function getMythosProfile(): Promise<MythosProfile> {
  const s = await mythosLogin();
  const res = await call<{ profile: MythosProfile }>("profile", {}, s.token);
  s.profile = res.profile;
  return res.profile;
}

export async function listCosmetics(): Promise<{
  cosmetics: MythosCosmetic[];
  profile: MythosProfile | null;
  loginError: string | null;
}> {
  let loginError: string | null = null;
  const s = await mythosLogin().catch((e) => {
    loginError = mythosErrorText(e);
    return null;
  });
  const res = await call<{ cosmetics: MythosCosmetic[]; profile: MythosProfile | null }>("cosmetics", {}, s?.token);
  if (s && res.profile) s.profile = res.profile;
  return { ...res, loginError };
}

export async function equipCape(cosmeticId: string | null): Promise<MythosProfile> {
  const s = await mythosLogin();
  const res = await call<{ profile: MythosProfile }>("equip", { cosmeticId }, s.token);
  s.profile = res.profile;
  return res.profile;
}

export async function createCape(input: {
  name: string;
  imageBase64: string;
  frames: number;
  frameTimeMs: number;
  plusOnly: boolean;
}): Promise<MythosCosmetic> {
  const s = await mythosLogin();
  const res = await call<{ cosmetic: MythosCosmetic }>("cosmetic-create", input, s.token);
  return res.cosmetic;
}

export async function deleteCosmetic(id: string): Promise<void> {
  const s = await mythosLogin();
  await call<{ ok: true }>("cosmetic-delete", { id }, s.token);
}
