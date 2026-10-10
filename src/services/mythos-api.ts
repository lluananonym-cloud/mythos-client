// Mythos-Backend (Supabase Edge Function "mcc"): Plus, Währung und Creator-Bewerbungen.
export const MYTHOS_API_URL = "https://rdxaqiacoitzeowehdts.supabase.co/functions/v1/mcc";

export interface CreatorApplication {
  mcName: string;
  discord: string;
  platform: string;
  channelUrl: string;
  followers: number;
  message: string;
}

async function call<T>(action: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(MYTHOS_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...body }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Fehler ${res.status}`);
  return data as T;
}

export const submitCreatorApplication = (application: CreatorApplication) =>
  call<{ ok: true }>("creator-apply", { ...application });
