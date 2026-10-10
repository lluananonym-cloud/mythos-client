import { useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "../ui/buttons/Button";
import { Input } from "../ui/Input";
import { TabHeader } from "../ui/TabHeader";
import { useMinecraftAuthStore } from "../../store/minecraft-auth-store";
import { submitCreatorApplication } from "../../services/mythos-api";

const PLATFORMS = ["YouTube", "Twitch", "TikTok", "Instagram", "Andere"];

/** Bewerbung für das Mythos Creator-Programm. Landet in der Tabelle mcc_creator_applications. */
export function CreatorPage() {
  const activeAccount = useMinecraftAuthStore((s) => s.activeAccount);
  const [mcName, setMcName] = useState(activeAccount?.minecraft_username ?? "");
  const [discord, setDiscord] = useState("");
  const [platform, setPlatform] = useState(PLATFORMS[0]);
  const [channelUrl, setChannelUrl] = useState("");
  const [followers, setFollowers] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    setSending(true);
    try {
      await submitCreatorApplication({
        mcName: mcName.trim(),
        discord: discord.trim(),
        platform,
        channelUrl: channelUrl.trim(),
        followers: Number(followers) || 0,
        message: message.trim(),
      });
      setSent(true);
      toast.success("Bewerbung abgeschickt!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TabHeader title="Creator-Programm" icon="solar:star-shine-bold" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-xl mx-auto flex flex-col gap-4 text-white">
          <p className="font-minecraft-ten text-sm text-white/70">
            Du machst Videos oder Streams mit Mythos Client? Bewirb dich als Creator und bekomm deinen eigenen Creator-Code.
          </p>
          {sent ? (
            <p className="font-minecraft-ten text-lg">Danke! Wir melden uns über Discord bei dir.</p>
          ) : (
            <>
              <Input label="Minecraft-Name" value={mcName} onChange={(e) => setMcName(e.target.value)} maxLength={16} />
              <Input label="Discord-Name" value={discord} onChange={(e) => setDiscord(e.target.value)} maxLength={64} />
              <label className="flex flex-col gap-1 font-minecraft-ten text-sm">
                Plattform
                <select
                  className="bg-black/30 border border-white/20 rounded px-3 py-2 text-white"
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                >
                  {PLATFORMS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </label>
              <Input
                label="Link zu deinem Kanal"
                placeholder="https://"
                value={channelUrl}
                onChange={(e) => setChannelUrl(e.target.value)}
                maxLength={300}
              />
              <Input
                label="Follower / Abonnenten"
                type="number"
                min={0}
                value={followers}
                onChange={(e) => setFollowers(e.target.value)}
              />
              <label className="flex flex-col gap-1 font-minecraft-ten text-sm">
                Warum willst du Creator werden?
                <textarea
                  className="bg-black/30 border border-white/20 rounded px-3 py-2 text-white min-h-28"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={2000}
                />
              </label>
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
