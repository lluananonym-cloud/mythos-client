import { useEffect, useState, type ReactNode } from "react";
import { toast } from "react-hot-toast";
import { Button } from "../ui/buttons/Button";
import { TabHeader } from "../ui/TabHeader";
import { useMinecraftAuthStore } from "../../store/minecraft-auth-store";
import {
  fetchChannelStats,
  getCreatorInfo,
  getMythosProfile,
  setCreatorCode,
  supportCreator,
  type CreatorInfo,
  mythosErrorText,
  submitCreatorApplication,
  type MythosProfile,
} from "../../services/mythos-api";

const PLATFORMS = ["YouTube", "Twitch", "TikTok", "Instagram", "Andere"];
const FIELD = "w-full bg-black/40 border border-white/20 rounded-md px-3 py-2 text-white font-minecraft-ten text-base focus:outline-none focus:border-purple-400";

function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-minecraft-ten text-sm text-white/90">{label}</span>
      {children}
      {hint && <span className="font-minecraft-ten text-xs text-white/50">{hint}</span>}
    </label>
  );
}

function detectPlatform(url: string): string | null {
  if (/youtube\.com|youtu\.be/i.test(url)) return "YouTube";
  if (/tiktok\.com/i.test(url)) return "TikTok";
  if (/twitch\.tv/i.test(url)) return "Twitch";
  if (/instagram\.com/i.test(url)) return "Instagram";
  return null;
}

/** Eigener Code für Creator: anzeigen, kopieren, ändern; dazu die Zahl der Unterstützer. */
function CreatorCodeCard({ info, onChange }: { info: CreatorInfo; onChange: (info: CreatorInfo) => void }) {
  const [draft, setDraft] = useState(info.code ?? "");
  const [saving, setSaving] = useState(false);
  useEffect(() => setDraft(info.code ?? ""), [info.code]);

  const save = async () => {
    setSaving(true);
    try {
      const code = await setCreatorCode(draft.trim());
      onChange({ ...info, code });
      toast.success("Creator-Code gespeichert");
    } catch (e) {
      toast.error(mythosErrorText(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-white/15 bg-black/30 p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-minecraft-ten text-sm text-white/60">Dein Creator-Code</p>
          <p className="font-minecraft-ten text-3xl text-purple-300">{info.code}</p>
        </div>
        <div className="text-right">
          <p className="font-minecraft-ten text-sm text-white/60">Unterstützer</p>
          <p className="font-minecraft-ten text-3xl">{info.supporters.toLocaleString("de-DE")}</p>
        </div>
        <div className="text-right">
          <p className="font-minecraft-ten text-sm text-white/60">Käufe mit Code</p>
          <p className="font-minecraft-ten text-3xl">{(info.purchases ?? 0).toLocaleString("de-DE")}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <input className={FIELD} value={draft} maxLength={16} onChange={(e) => setDraft(e.target.value)} />
        <Button size="sm" onClick={save} disabled={saving || !draft.trim() || draft.trim() === info.code}>
          {saving ? "Speichert..." : "Ändern"}
        </Button>
        <Button
          size="sm"
          onClick={() => {
            void navigator.clipboard.writeText(info.code ?? "");
            toast.success("Code kopiert");
          }}
        >
          Kopieren
        </Button>
      </div>
      <p className="font-minecraft-ten text-xs text-white/50">
        Spieler tragen deinen Code im Launcher unter Creator ein und unterstützen dich damit.
      </p>
    </div>
  );
}

/** Für alle Spieler: einen Creator-Code eintragen, um einen Creator zu unterstützen. */
function SupportCard({ info, onChange }: { info: CreatorInfo; onChange: (info: CreatorInfo) => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const apply = async (value: string | null) => {
    setBusy(true);
    try {
      const supporting = await supportCreator(value);
      onChange({ ...info, supporting });
      setCode("");
      toast.success(supporting ? `Du unterstützt jetzt ${supporting.name}` : "Creator-Code entfernt");
    } catch (e) {
      toast.error(mythosErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-white/15 bg-black/30 p-5 flex flex-col gap-3">
      <p className="font-minecraft-ten text-lg">Creator unterstützen</p>
      {info.supporting ? (
        <div className="flex items-center justify-between gap-3">
          <p className="font-minecraft-ten text-sm text-white/80">
            Du unterstützt <span className="text-purple-300">{info.supporting.name}</span> (Code {info.supporting.code})
          </p>
          <Button size="sm" onClick={() => void apply(null)} disabled={busy}>Entfernen</Button>
        </div>
      ) : (
        <p className="font-minecraft-ten text-sm text-white/60">Trag den Code deines Lieblings-Creators ein.</p>
      )}
      <div className="flex gap-2">
        <input
          className={FIELD}
          placeholder="Creator-Code"
          value={code}
          maxLength={16}
          onChange={(e) => setCode(e.target.value)}
        />
        <Button size="sm" onClick={() => void apply(code.trim())} disabled={busy || !code.trim()}>
          Eintragen
        </Button>
      </div>
    </div>
  );
}

/** Creator-Programm: Bewerbung (landet in mcc_creator_applications) bzw. Status für Creator. */
export function CreatorPage() {
  const activeAccount = useMinecraftAuthStore((s) => s.activeAccount);
  const [profile, setProfile] = useState<MythosProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [creatorInfo, setCreatorInfo] = useState<CreatorInfo | null>(null);
  const [mcName, setMcName] = useState(activeAccount?.minecraft_username ?? "");
  const [discord, setDiscord] = useState("");
  const [platform, setPlatform] = useState(PLATFORMS[0]);
  const [channelUrl, setChannelUrl] = useState("");
  const [followers, setFollowers] = useState<number | null>(null);
  const [channelName, setChannelName] = useState<string | null>(null);
  const [statsState, setStatsState] = useState<"idle" | "loading" | "error">("idle");
  const [statsError, setStatsError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    getMythosProfile()
      .then((p) => {
        setProfile(p);
        setMcName((n) => n || p.name);
        return getCreatorInfo().then(setCreatorInfo);
      })
      .catch((e) => setProfileError(mythosErrorText(e)));
  }, []);

  // Abonnenten live holen, sobald ein Kanal-Link eingetragen ist.
  useEffect(() => {
    const url = channelUrl.trim();
    setFollowers(null);
    setChannelName(null);
    setStatsError(null);
    if (!/^https?:\/\/\S+\.\S+/.test(url)) {
      setStatsState("idle");
      return;
    }
    const detected = detectPlatform(url);
    if (detected) setPlatform(detected);
    setStatsState("loading");
    let cancelled = false;
    const timer = setTimeout(() => {
      fetchChannelStats(url)
        .then((res) => {
          if (cancelled) return;
          setFollowers(res.followers);
          setChannelName(res.name);
          setStatsState("idle");
        })
        .catch((e) => {
          if (cancelled) return;
          setStatsError(mythosErrorText(e));
          setStatsState("error");
        });
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [channelUrl]);

  const submit = async () => {
    setSending(true);
    try {
      await submitCreatorApplication({
        mcName: mcName.trim(),
        discord: discord.trim(),
        platform,
        channelUrl: channelUrl.trim(),
        followers: followers ?? 0,
        message: message.trim(),
      });
      setSent(true);
      toast.success("Bewerbung abgeschickt!");
    } catch (e) {
      toast.error(mythosErrorText(e));
    } finally {
      setSending(false);
    }
  };

  const followerHint =
    statsState === "loading" ? "Wird live abgerufen..."
    : statsState === "error" ? statsError
    : followers !== null ? `Live abgerufen${channelName ? ` für ${channelName}` : ""}`
    : "Wird automatisch aus deinem Kanal-Link geholt.";

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TabHeader title="Creator-Programm" icon="solar:star-shine-bold" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-xl mx-auto flex flex-col gap-4 text-white">
          {profileError && (
            <p className="font-minecraft-ten text-sm text-red-300 rounded-md border border-red-400/40 bg-red-500/10 p-3">
              {profileError}
            </p>
          )}
          {creatorInfo && <SupportCard info={creatorInfo} onChange={setCreatorInfo} />}
          {profile?.creator ? (
            <>
              <div className="rounded-lg border border-purple-400/50 bg-purple-500/15 p-5 flex flex-col gap-2">
                <p className="font-minecraft-ten text-2xl">Du bist Mythos Creator</p>
                <p className="font-minecraft-ten text-sm text-white/70">
                  {profile.name}
                  {profile.owner ? " · Owner" : ""} · {profile.coins} Coins{profile.plus ? " · Plus" : ""}
                </p>
              </div>
              {creatorInfo?.code && <CreatorCodeCard info={creatorInfo} onChange={setCreatorInfo} />}
            </>
          ) : sent ? (
            <p className="font-minecraft-ten text-lg">Danke! Wir melden uns über Discord bei dir.</p>
          ) : (
            <>
              <p className="font-minecraft-ten text-sm text-white/70">
                Du machst Videos oder Streams mit Mythos Client? Bewirb dich als Creator und bekomm deinen eigenen Creator-Code.
              </p>
              <Field label="Minecraft-Name">
                <input className={FIELD} value={mcName} onChange={(e) => setMcName(e.target.value)} maxLength={16} />
              </Field>
              <Field label="Discord-Name">
                <input className={FIELD} value={discord} onChange={(e) => setDiscord(e.target.value)} maxLength={64} />
              </Field>
              <Field label="Link zu deinem Kanal">
                <input
                  className={FIELD}
                  placeholder="https://youtube.com/@deinkanal"
                  value={channelUrl}
                  onChange={(e) => setChannelUrl(e.target.value)}
                  maxLength={300}
                />
              </Field>
              <Field label="Plattform">
                <select className={FIELD} value={platform} onChange={(e) => setPlatform(e.target.value)}>
                  {PLATFORMS.map((p) => (
                    <option key={p} value={p} className="bg-neutral-900">{p}</option>
                  ))}
                </select>
              </Field>
              <Field label="Abonnenten / Follower" hint={followerHint}>
                {statsState === "error" ? (
                  <input
                    className={FIELD}
                    type="number"
                    min={0}
                    placeholder="Selbst eintragen"
                    value={followers ?? ""}
                    onChange={(e) => setFollowers(e.target.value === "" ? null : Math.max(0, Number(e.target.value) || 0))}
                  />
                ) : (
                  <div className={`${FIELD} text-white/80`}>
                    {followers !== null ? followers.toLocaleString("de-DE") : "–"}
                  </div>
                )}
              </Field>
              <Field label="Warum willst du Creator werden?">
                <textarea
                  className={`${FIELD} min-h-28`}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={2000}
                />
              </Field>
              <Button
                onClick={submit}
                disabled={sending || !mcName.trim() || !discord.trim() || !channelUrl.trim()}
              >
                {sending ? "Wird gesendet..." : "Bewerbung abschicken"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
