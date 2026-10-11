package gg.mythoscraft.client;

import gg.mythoscraft.client.mixin.SimpleOptionAccessor;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientLifecycleEvents;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;
import net.minecraft.util.Identifier;
import org.lwjgl.glfw.GLFW;

import java.util.ArrayDeque;
import java.util.Deque;

/** Client-Features wie im NoRisk Client: Zoom, Fullbright, Toggle-Sprint und HUD (FPS, CPS, Tasten, Koordinaten). */
public final class Features {
    private static final KeyBinding.Category CATEGORY = KeyBinding.Category.create(Identifier.of("mythosclient", "main"));
    private static KeyBinding zoomKey;
    private static KeyBinding fullbrightKey;
    private static KeyBinding sprintKey;
    private static KeyBinding shopKey;

    private static Integer fovBeforeZoom;
    private static Double gammaBeforeFullbright;
    private static final Deque<Long> LEFT_CLICKS = new ArrayDeque<>();
    private static final Deque<Long> RIGHT_CLICKS = new ArrayDeque<>();
    private static boolean leftDown;
    private static boolean rightDown;

    private Features() {}

    public static void register() {
        zoomKey = KeyBindingHelper.registerKeyBinding(new KeyBinding("key.mythosclient.zoom", InputUtil.Type.KEYSYM, GLFW.GLFW_KEY_C, CATEGORY));
        fullbrightKey = KeyBindingHelper.registerKeyBinding(new KeyBinding("key.mythosclient.fullbright", InputUtil.Type.KEYSYM, GLFW.GLFW_KEY_G, CATEGORY));
        sprintKey = KeyBindingHelper.registerKeyBinding(new KeyBinding("key.mythosclient.togglesprint", InputUtil.Type.KEYSYM, GLFW.GLFW_KEY_V, CATEGORY));

        shopKey = KeyBindingHelper.registerKeyBinding(new KeyBinding("key.mythosclient.shop", InputUtil.Type.KEYSYM, GLFW.GLFW_KEY_M, CATEGORY));

        ClientTickEvents.END_CLIENT_TICK.register(Features::tick);
        ClientLifecycleEvents.CLIENT_STOPPING.register(client -> {
            stopZoom(client);
            stopFullbright(client);
        });
    }

    private static void tick(MinecraftClient client) {
        MythosConfig config = MythosConfig.get();

        // Zoom: solange die Taste gedrückt ist, kleines Sichtfeld und weiche Kamera.
        if (zoomKey.isPressed() && client.currentScreen == null) {
            if (fovBeforeZoom == null) {
                fovBeforeZoom = client.options.getFov().getValue();
                client.options.smoothCameraEnabled = true;
                ((SimpleOptionAccessor) (Object) client.options.getFov()).mythos$setValue(config.zoomFov);
            }
        } else {
            stopZoom(client);
        }

        while (fullbrightKey.wasPressed()) {
            if (gammaBeforeFullbright == null) {
                gammaBeforeFullbright = client.options.getGamma().getValue();
                ((SimpleOptionAccessor) (Object) client.options.getGamma()).mythos$setValue(15.0);
                message(client, "Fullbright an");
            } else {
                stopFullbright(client);
                message(client, "Fullbright aus");
            }
        }

        while (sprintKey.wasPressed()) {
            config.toggleSprint = !config.toggleSprint;
            config.save();
            message(client, "Toggle-Sprint " + (config.toggleSprint ? "an" : "aus"));
        }
        if (config.toggleSprint && client.player != null && client.options.forwardKey.isPressed()
                && !client.player.isSneaking() && !client.player.horizontalCollision) {
            client.player.setSprinting(true);
        }
    }

    /** Wurde die Shop-Taste gedrückt (nur ohne offenes Menü)? */
    public static boolean shopPressed() {
        boolean pressed = false;
        while (shopKey != null && shopKey.wasPressed()) pressed = true;
        return pressed && MinecraftClient.getInstance().currentScreen == null;
    }

    private static void stopZoom(MinecraftClient client) {
        if (fovBeforeZoom == null) return;
        ((SimpleOptionAccessor) (Object) client.options.getFov()).mythos$setValue(fovBeforeZoom);
        client.options.smoothCameraEnabled = false;
        fovBeforeZoom = null;
    }

    private static void stopFullbright(MinecraftClient client) {
        if (gammaBeforeFullbright == null) return;
        ((SimpleOptionAccessor) (Object) client.options.getGamma()).mythos$setValue(gammaBeforeFullbright);
        gammaBeforeFullbright = null;
    }

    private static void message(MinecraftClient client, String text) {
        if (client.player != null) client.player.sendMessage(Text.literal(text).formatted(Formatting.AQUA), true);
    }

    /** Zeichnet die HUD-Elemente unter der Mythos-Zeile oben links. */
    public static void renderHud(DrawContext ctx, MinecraftClient client, int y) {
        MythosConfig config = MythosConfig.get();
        long now = System.currentTimeMillis();
        boolean left = client.options.attackKey.isPressed();
        boolean right = client.options.useKey.isPressed();
        if (left && !leftDown) LEFT_CLICKS.add(now);
        if (right && !rightDown) RIGHT_CLICKS.add(now);
        leftDown = left;
        rightDown = right;
        while (!LEFT_CLICKS.isEmpty() && now - LEFT_CLICKS.peekFirst() > 1000) LEFT_CLICKS.pollFirst();
        while (!RIGHT_CLICKS.isEmpty() && now - RIGHT_CLICKS.peekFirst() > 1000) RIGHT_CLICKS.pollFirst();

        int line = 10;
        if (config.fps) {
            ctx.drawTextWithShadow(client.textRenderer, Text.literal(client.getCurrentFps() + " FPS"), 4, y, 0xFFFFFFFF);
            y += line;
        }
        if (config.cps) {
            ctx.drawTextWithShadow(client.textRenderer, Text.literal(LEFT_CLICKS.size() + " | " + RIGHT_CLICKS.size() + " CPS"), 4, y, 0xFFFFFFFF);
            y += line;
        }
        if (config.coords && client.player != null) {
            String pos = String.format("XYZ %.1f / %.1f / %.1f", client.player.getX(), client.player.getY(), client.player.getZ());
            ctx.drawTextWithShadow(client.textRenderer, Text.literal(pos), 4, y, 0xFFFFFFFF);
            y += line;
        }
        if (config.keystrokes) {
            y += 2;
            int s = 18;
            int gap = 2;
            key(ctx, client, "W", client.options.forwardKey.isPressed(), 4 + s + gap, y, s, s);
            y += s + gap;
            key(ctx, client, "A", client.options.leftKey.isPressed(), 4, y, s, s);
            key(ctx, client, "S", client.options.backKey.isPressed(), 4 + s + gap, y, s, s);
            key(ctx, client, "D", client.options.rightKey.isPressed(), 4 + 2 * (s + gap), y, s, s);
            y += s + gap;
            int half = (3 * s + 2 * gap - gap) / 2;
            key(ctx, client, "LMB", left, 4, y, half, s);
            key(ctx, client, "RMB", right, 4 + half + gap, y, half, s);
        }
    }

    private static void key(DrawContext ctx, MinecraftClient client, String label, boolean pressed, int x, int y, int w, int h) {
        ctx.fill(x, y, x + w, y + h, pressed ? 0xAAFFFFFF : 0x66000000);
        int color = pressed ? 0xFF000000 : 0xFFFFFFFF;
        ctx.drawText(client.textRenderer, label, x + (w - client.textRenderer.getWidth(label)) / 2, y + (h - 8) / 2, color, false);
    }

    /** Für /mcc hud <element>. Gibt den neuen Zustand zurück oder null, wenn es das Element nicht gibt. */
    public static Boolean toggleHud(String element) {
        MythosConfig c = MythosConfig.get();
        Boolean state = switch (element) {
            case "an", "aus", "all" -> (c.hud = !c.hud);
            case "fps" -> (c.fps = !c.fps);
            case "cps" -> (c.cps = !c.cps);
            case "tasten", "keys", "keystrokes" -> (c.keystrokes = !c.keystrokes);
            case "koordinaten", "coords" -> (c.coords = !c.coords);
            default -> null;
        };
        if (state != null) c.save();
        return state;
    }
}
