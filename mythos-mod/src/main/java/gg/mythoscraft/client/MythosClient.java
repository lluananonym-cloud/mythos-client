package gg.mythoscraft.client;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.mojang.brigadier.arguments.IntegerArgumentType;
import com.mojang.brigadier.arguments.StringArgumentType;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.command.v2.ClientCommandManager;
import net.fabricmc.fabric.api.client.command.v2.ClientCommandRegistrationCallback;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientLifecycleEvents;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.rendering.v1.hud.HudElementRegistry;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.network.AbstractClientPlayerEntity;
import net.minecraft.command.CommandSource;
import net.minecraft.text.MutableText;
import net.minecraft.text.Style;
import net.minecraft.text.StyleSpriteSource;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;
import net.minecraft.util.Identifier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

public class MythosClient implements ClientModInitializer {
    public static final Logger LOG = LoggerFactory.getLogger("Mythos Client");
    public static final Identifier ICON_FONT = Identifier.of("mythosclient", "icons");

    /** Bekannte Spieler: UUID ohne Bindestriche -> Plus. Fehlt ein Eintrag, nutzt der Spieler kein Mythos Client. */
    private static final Map<String, Boolean> PLAYERS = new ConcurrentHashMap<>();
    private static final Map<String, Long> ASKED = new ConcurrentHashMap<>();

    private static volatile String token;
    private static volatile JsonObject profile;
    private int ticks;

    @Override
    public void onInitializeClient() {
        ClientLifecycleEvents.CLIENT_STARTED.register(client -> login(client));
        Features.register();

        ClientCommandRegistrationCallback.EVENT.register((dispatcher, registryAccess) -> dispatcher.register(
                ClientCommandManager.literal("mcc")
                        .executes(ctx -> {
                            if (profile == null) {
                                ctx.getSource().sendFeedback(prefix().append(Text.literal("Nicht angemeldet.").formatted(Formatting.RED)));
                            } else {
                                ctx.getSource().sendFeedback(prefix().append(Text.literal(
                                        "Währung: " + coins() + (plus() ? " · Plus aktiv" : ""))));
                            }
                            return 1;
                        })
                        .then(ClientCommandManager.literal("hud")
                                .executes(ctx -> hud(ctx.getSource(), "all"))
                                .then(ClientCommandManager.argument("element", StringArgumentType.word())
                                        .suggests((ctx, b) -> CommandSource.suggestMatching(
                                                new String[]{"fps", "cps", "tasten", "koordinaten"}, b))
                                        .executes(ctx -> hud(ctx.getSource(), StringArgumentType.getString(ctx, "element")))))
                        .then(ClientCommandManager.argument("anzahl", IntegerArgumentType.integer(1)).executes(ctx -> {
                            int amount = IntegerArgumentType.getInteger(ctx, "anzahl");
                            give(amount);
                            return 1;
                        }))));

        HudElementRegistry.addLast(Identifier.of("mythosclient", "hud"), (ctx, tickCounter) -> {
            MinecraftClient mc = MinecraftClient.getInstance();
            if (!MythosConfig.get().hud || mc.options.hudHidden) return;
            MutableText line = icon().append(Text.literal(" Mythos Client").formatted(Formatting.WHITE));
            if (profile != null) {
                if (plus()) line.append(Text.literal(" Plus").formatted(Formatting.GOLD));
                line.append(Text.literal(" · " + coins() + " Coins").formatted(Formatting.YELLOW));
            }
            ctx.drawTextWithShadow(mc.textRenderer, line, 4, 4, 0xFFFFFFFF);
            Features.renderHud(ctx, mc, 16);
        });

        ClientTickEvents.END_CLIENT_TICK.register(client -> {
            if (client.world == null || ++ticks % 100 != 0) return;
            List<String> unknown = new ArrayList<>();
            long now = System.currentTimeMillis();
            for (AbstractClientPlayerEntity p : client.world.getPlayers()) {
                String id = clean(p.getUuid());
                Long last = ASKED.get(id);
                if (last == null || now - last > 60_000) {
                    unknown.add(id);
                    ASKED.put(id, now);
                }
            }
            if (unknown.isEmpty()) return;
            MythosApi.players(unknown).thenAccept(res -> {
                for (JsonElement el : res.getAsJsonArray("players")) {
                    JsonObject o = el.getAsJsonObject();
                    String id = o.get("uuid").getAsString();
                    PLAYERS.put(id, o.get("plus").getAsBoolean());
                    CapeManager.setPlayerCape(id, capeInfo(o.get("cape")));
                }
            }).exceptionally(e -> null);
        });
    }

    private static void login(MinecraftClient client) {
        UUID uuid = client.getSession().getUuidOrNull();
        String accessToken = client.getSession().getAccessToken();
        String username = client.getSession().getUsername();
        if (uuid == null) return;
        byte[] random = new byte[16];
        new SecureRandom().nextBytes(random);
        String serverId = HexFormat.of().formatHex(random);
        Thread t = new Thread(() -> {
            try {
                MythosApi.joinServer(accessToken, clean(uuid), serverId);
                JsonObject res = MythosApi.session(username, serverId).join();
                token = res.get("token").getAsString();
                profile = res.getAsJsonObject("profile");
                PLAYERS.put(clean(uuid), plus());
                ASKED.remove(clean(uuid)); // eigenes Cape gleich mit abfragen
                LOG.info("Angemeldet als {} (Plus: {})", username, plus());
            } catch (Exception e) {
                LOG.warn("Mythos-Anmeldung fehlgeschlagen: {}", e.getMessage());
            }
        }, "Mythos Login");
        t.setDaemon(true);
        t.start();
    }

    private static int hud(net.fabricmc.fabric.api.client.command.v2.FabricClientCommandSource source, String element) {
        Boolean state = Features.toggleHud(element);
        if (state == null) {
            source.sendFeedback(prefix().append(Text.literal("Gibt es nicht. Möglich: fps, cps, tasten, koordinaten").formatted(Formatting.RED)));
        } else {
            source.sendFeedback(prefix().append(Text.literal("HUD " + element + ": " + (state ? "an" : "aus"))));
        }
        return 1;
    }

    private static CapeManager.CapeInfo capeInfo(JsonElement el) {
        if (el == null || !el.isJsonObject()) return null;
        JsonObject c = el.getAsJsonObject();
        return new CapeManager.CapeInfo(c.get("url").getAsString(), c.get("frames").getAsInt(), c.get("frameTimeMs").getAsInt());
    }

    private static void give(int amount) {
        MinecraftClient mc = MinecraftClient.getInstance();
        if (token == null) {
            chat(prefix().append(Text.literal("Nicht angemeldet.").formatted(Formatting.RED)));
            return;
        }
        MythosApi.give(token, amount).thenAccept(res -> {
            profile = res.getAsJsonObject("profile");
            chat(prefix().append(Text.literal("+" + amount + " Coins. Jetzt: " + coins()).formatted(Formatting.GREEN)));
        }).exceptionally(e -> {
            Throwable cause = e.getCause() != null ? e.getCause() : e;
            chat(prefix().append(Text.literal(cause.getMessage()).formatted(Formatting.RED)));
            return null;
        });
    }

    private static void chat(Text text) {
        MinecraftClient mc = MinecraftClient.getInstance();
        mc.execute(() -> mc.inGameHud.getChatHud().addMessage(text));
    }

    private static MutableText prefix() {
        return icon().append(Text.literal(" [MCC] ").formatted(Formatting.AQUA));
    }

    public static MutableText icon() {
        return Text.literal("").setStyle(Style.EMPTY.withFont(new StyleSpriteSource.Font(ICON_FONT)).withColor(Formatting.WHITE));
    }

    /** null = kein Mythos-Client-Spieler, sonst ob er Plus hat. */
    public static Boolean playerStatus(UUID uuid) {
        return PLAYERS.get(clean(uuid));
    }

    private static boolean plus() {
        JsonObject p = profile;
        return p != null && p.get("plus").getAsBoolean();
    }

    private static long coins() {
        JsonObject p = profile;
        return p == null ? 0 : p.get("coins").getAsLong();
    }

    private static String clean(UUID uuid) {
        return uuid.toString().replace("-", "");
    }
}
