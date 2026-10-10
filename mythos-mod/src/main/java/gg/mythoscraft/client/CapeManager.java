package gg.mythoscraft.client;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.texture.NativeImage;
import net.minecraft.client.texture.NativeImageBackedTexture;
import net.minecraft.util.Identifier;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Lädt Mythos-Capes und gibt pro Spieler die passende Textur zurück.
 * Animierte Capes sind mehrere 64x32-Bilder untereinander; jedes Bild wird als eigene Textur registriert.
 */
public final class CapeManager {
    public record CapeInfo(String url, int frames, int frameTimeMs) {}

    private record LoadedCape(Identifier[] frames, int frameTimeMs) {}

    private static final HttpClient HTTP = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    private static final Map<String, CapeInfo> PLAYER_CAPES = new ConcurrentHashMap<>();
    private static final Map<String, LoadedCape> LOADED = new ConcurrentHashMap<>();
    private static final Map<String, Boolean> LOADING = new ConcurrentHashMap<>();

    private CapeManager() {}

    public static void setPlayerCape(String uuid, CapeInfo cape) {
        if (cape == null) PLAYER_CAPES.remove(uuid);
        else PLAYER_CAPES.put(uuid, cape);
    }

    /** Aktuelles Bild des Capes dieses Spielers oder null (dann bleibt das normale Cape). */
    public static Identifier capeFor(UUID uuid) {
        CapeInfo info = PLAYER_CAPES.get(uuid.toString().replace("-", ""));
        if (info == null) return null;
        LoadedCape cape = LOADED.get(info.url());
        if (cape == null) {
            load(info);
            return null;
        }
        if (cape.frames().length == 1) return cape.frames()[0];
        long index = (System.currentTimeMillis() / Math.max(20, cape.frameTimeMs())) % cape.frames().length;
        return cape.frames()[(int) index];
    }

    private static void load(CapeInfo info) {
        if (LOADING.putIfAbsent(info.url(), true) != null) return;
        HttpRequest req = HttpRequest.newBuilder(URI.create(info.url())).timeout(Duration.ofSeconds(20)).GET().build();
        HTTP.sendAsync(req, HttpResponse.BodyHandlers.ofByteArray()).thenAccept(res -> {
            try {
                if (res.statusCode() != 200) throw new IllegalStateException("HTTP " + res.statusCode());
                BufferedImage full = ImageIO.read(new ByteArrayInputStream(res.body()));
                int width = full.getWidth();
                int frameHeight = width / 2;
                int count = Math.max(1, Math.min(info.frames(), full.getHeight() / frameHeight));
                byte[][] frames = new byte[count][];
                for (int i = 0; i < count; i++) {
                    ByteArrayOutputStream out = new ByteArrayOutputStream();
                    ImageIO.write(full.getSubimage(0, i * frameHeight, width, frameHeight), "png", out);
                    frames[i] = out.toByteArray();
                }
                MinecraftClient client = MinecraftClient.getInstance();
                client.execute(() -> {
                    try {
                        Identifier[] ids = new Identifier[count];
                        String key = Integer.toHexString(info.url().hashCode());
                        for (int i = 0; i < count; i++) {
                            NativeImage image = NativeImage.read(new ByteArrayInputStream(frames[i]));
                            ids[i] = Identifier.of("mythosclient", "capes/" + key + "/" + i);
                            client.getTextureManager().registerTexture(ids[i], new NativeImageBackedTexture(image));
                        }
                        LOADED.put(info.url(), new LoadedCape(ids, info.frameTimeMs()));
                    } catch (Exception e) {
                        MythosClient.LOG.warn("Cape konnte nicht geladen werden: {}", e.getMessage());
                    }
                });
            } catch (Exception e) {
                MythosClient.LOG.warn("Cape konnte nicht geladen werden: {}", e.getMessage());
            }
        }).exceptionally(e -> null); // kein neuer Versuch bis zum nächsten Start, damit nichts spammt
    }
}
