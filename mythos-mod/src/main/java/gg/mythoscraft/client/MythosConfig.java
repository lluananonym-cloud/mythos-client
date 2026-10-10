package gg.mythoscraft.client;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import net.fabricmc.loader.api.FabricLoader;

import java.nio.file.Files;
import java.nio.file.Path;

/** Einstellungen der Mythos-Features, gespeichert in config/mythosclient.json. */
public final class MythosConfig {
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final Path FILE = FabricLoader.getInstance().getConfigDir().resolve("mythosclient.json");
    private static MythosConfig instance;

    public boolean hud = true;
    public boolean fps = true;
    public boolean cps = true;
    public boolean keystrokes = true;
    public boolean coords = false;
    public boolean toggleSprint = false;
    public int zoomFov = 30;

    public static MythosConfig get() {
        if (instance == null) {
            try {
                instance = Files.exists(FILE) ? GSON.fromJson(Files.readString(FILE), MythosConfig.class) : new MythosConfig();
            } catch (Exception e) {
                MythosClient.LOG.warn("Einstellungen konnten nicht gelesen werden: {}", e.getMessage());
            }
            if (instance == null) instance = new MythosConfig();
        }
        return instance;
    }

    public void save() {
        try {
            Files.writeString(FILE, GSON.toJson(this));
        } catch (Exception e) {
            MythosClient.LOG.warn("Einstellungen konnten nicht gespeichert werden: {}", e.getMessage());
        }
    }
}
