// Mythos-Backend (Supabase Edge Function "mcc"): Plus, Währung, Cosmetics und Creator-Bewerbungen.
import { invoke } from "@tauri-apps/api/core";

export const MYTHOS_API_URL = "https://rdxaqiacoitzeowehdts.supabase.co/functions/v1/mcc";

export interface MythosProfile {
  uuid: string;
  name: string;
  plus: boolean;
  coins: number;
  owner: boolean;
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

async function call<T>(action: string, body: Record<string, unknown> = {}, token?: string): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(MYTHOS_API_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ action, ...body }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Fehler ${res.status}`);
  return data as T;
}

/** Meldet das aktive Minecraft-Konto beim Mythos-Backend an (einmal pro Launcher-Start). */
export async function mythosLogin(force = false): Promise<{ token: string; profile: MythosProfile }> {
  if (session && !force) return session;
  const res = await invoke<{ token: string; profile: MythosProfile }>("mythos_login");
  session = { token: res.token, profile: res.profile };
  return session;
}

export const submitCreatorApplication = (application: CreatorApplication) =>
  call<{ ok: true }>("creator-apply", { ...application });

export async function listCosmetics(): Promise<{ cosmetics: MythosCosmetic[]; profile: MythosProfile | null }> {
  const s = await mythosLogin().catch(() => null);
  const res = await call<{ cosmetics: MythosCosmetic[]; profile: MythosProfile | null }>("cosmetics", {}, s?.token);
  if (s && res.profile) s.profile = res.profile;
  return res;
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
