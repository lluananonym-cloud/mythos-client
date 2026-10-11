package gg.mythoscraft.client;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.client.gui.widget.TextFieldWidget;
import net.minecraft.text.Text;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CompletableFuture;

/** Ingame-Shop: Coins, Creator-Code und Mythos-Cosmetics kaufen und anlegen. */
public class ShopScreen extends Screen {
    private static final int PER_PAGE = 5;

    private record Item(String id, String name, long price, boolean plusOnly) {}

    private final List<Item> items = new ArrayList<>();
    private final Set<String> owned = new HashSet<>();
    private String equipped;
    private String supporting;
    private String status = "Lade Shop...";
    private int statusColor = 0xFFAAAAAA;
    private int page;
    private boolean busy;
    private TextFieldWidget codeField;
    private String codeDraft = "";

    public ShopScreen() {
        super(Text.literal("Mythos Shop"));
    }

    @Override
    protected void init() {
        int cx = width / 2;
        int top = 48;

        codeField = new TextFieldWidget(textRenderer, cx - 150, top, 160, 20, Text.literal("Creator-Code"));
        codeField.setMaxLength(16);
        codeField.setText(codeDraft);
        codeField.setChangedListener(t -> codeDraft = t);
        addDrawableChild(codeField);
        addDrawableChild(ButtonWidget.builder(Text.literal("Code eintragen"), b -> setCode(codeDraft.trim()))
                .dimensions(cx + 14, top, 70, 20).build());
        addDrawableChild(ButtonWidget.builder(Text.literal("Entfernen"), b -> setCode(null))
                .dimensions(cx + 88, top, 62, 20).build());

        int y = top + 40;
        int from = page * PER_PAGE;
        for (int i = from; i < Math.min(items.size(), from + PER_PAGE); i++) {
            Item item = items.get(i);
            ButtonWidget button = ButtonWidget.builder(Text.literal(label(item)), b -> act(item))
                    .dimensions(cx + 50, y, 100, 20).build();
            button.active = !busy && canAct(item);
            addDrawableChild(button);
            y += 24;
        }

        int pages = Math.max(1, (items.size() + PER_PAGE - 1) / PER_PAGE);
        int bottom = height - 28;
        ButtonWidget prev = ButtonWidget.builder(Text.literal("<"), b -> { page--; clearAndInit(); })
                .dimensions(cx - 150, bottom, 20, 20).build();
        prev.active = page > 0;
        addDrawableChild(prev);
        ButtonWidget next = ButtonWidget.builder(Text.literal(">"), b -> { page++; clearAndInit(); })
                .dimensions(cx - 126, bottom, 20, 20).build();
        next.active = page < pages - 1;
        addDrawableChild(next);
        addDrawableChild(ButtonWidget.builder(Text.literal("Fertig"), b -> close())
                .dimensions(cx + 50, bottom, 100, 20).build());

        if (items.isEmpty() && "Lade Shop...".equals(status)) load();
    }

    private boolean plus() {
        JsonObject p = MythosClient.profile();
        return p != null && p.get("plus").getAsBoolean();
    }

    private boolean isOwner() {
        JsonObject p = MythosClient.profile();
        return p != null && p.has("owner") && p.get("owner").getAsBoolean();
    }

    private boolean mustBuy(Item item) {
        return item.price() > 0 && !owned.contains(item.id()) && !isOwner();
    }

    private boolean canAct(Item item) {
        if (MythosClient.token() == null) return false;
        if (item.plusOnly() && !plus()) return false;
        return !mustBuy(item) || MythosClient.coins() >= item.price();
    }

    private String label(Item item) {
        if (item.plusOnly() && !plus()) return "Nur Plus";
        if (item.id().equals(equipped)) return "Ablegen";
        if (mustBuy(item)) return MythosClient.coins() >= item.price() ? "Kaufen" : "Zu wenig Coins";
        return "Anlegen";
    }

    private void load() {
        String token = MythosClient.token();
        if (token == null) {
            show("Nicht angemeldet. Starte das Spiel über den Mythos Launcher.", 0xFFFF5555);
            return;
        }
        MythosApi.cosmetics(token).thenAccept(res -> {
            List<Item> list = new ArrayList<>();
            for (JsonElement el : res.getAsJsonArray("cosmetics")) {
                JsonObject c = el.getAsJsonObject();
                list.add(new Item(c.get("id").getAsString(), c.get("name").getAsString(),
                        c.has("price") ? c.get("price").getAsLong() : 0, c.get("plusOnly").getAsBoolean()));
            }
            Set<String> ownedNow = new HashSet<>();
            if (res.has("owned")) res.getAsJsonArray("owned").forEach(e -> ownedNow.add(e.getAsString()));
            String eq = res.has("equippedCape") && !res.get("equippedCape").isJsonNull() ? res.get("equippedCape").getAsString() : null;
            if (res.has("profile") && res.get("profile").isJsonObject()) MythosClient.setProfile(res.getAsJsonObject("profile"));
            ui(() -> {
                items.clear();
                items.addAll(list);
                owned.clear();
                owned.addAll(ownedNow);
                equipped = eq;
                status = list.isEmpty() ? "Noch keine Cosmetics im Shop." : "";
                statusColor = 0xFFAAAAAA;
            });
        }).exceptionally(e -> fail(e));
        MythosApi.creatorInfo(token).thenAccept(res -> {
            String s = null;
            if (res.has("supporting") && res.get("supporting").isJsonObject()) {
                s = res.getAsJsonObject("supporting").get("code").getAsString();
            }
            String finalS = s;
            ui(() -> supporting = finalS);
        }).exceptionally(e -> null);
    }

    private void act(Item item) {
        String token = MythosClient.token();
        if (token == null || busy) return;
        busy = true;
        clearAndInit();
        CompletableFuture<JsonObject> call;
        String done;
        if (item.id().equals(equipped)) {
            call = MythosApi.equip(token, null);
            done = "Cape abgelegt.";
        } else if (mustBuy(item)) {
            call = MythosApi.buy(token, item.id()).thenCompose(res -> {
                MythosClient.setProfile(res.getAsJsonObject("profile"));
                ui(() -> res.getAsJsonArray("owned").forEach(e -> owned.add(e.getAsString())));
                return MythosApi.equip(token, item.id());
            });
            done = item.name() + " gekauft und angelegt!";
        } else {
            call = MythosApi.equip(token, item.id());
            done = item.name() + " angelegt.";
        }
        call.thenAccept(res -> {
            JsonObject p = res.getAsJsonObject("profile");
            MythosClient.setProfile(p);
            String eq = p.has("equippedCape") && !p.get("equippedCape").isJsonNull() ? p.get("equippedCape").getAsString() : null;
            MythosClient.refreshOwnCape();
            ui(() -> {
                equipped = eq;
                busy = false;
                status = done;
                statusColor = 0xFF55FF55;
            });
        }).exceptionally(e -> fail(e));
    }

    private void setCode(String code) {
        String token = MythosClient.token();
        if (token == null || busy) return;
        if (code != null && code.isEmpty()) return;
        busy = true;
        clearAndInit();
        MythosApi.support(token, code).thenAccept(res -> {
            String s = res.has("supporting") && res.get("supporting").isJsonObject()
                    ? res.getAsJsonObject("supporting").get("code").getAsString() : null;
            ui(() -> {
                supporting = s;
                codeDraft = "";
                busy = false;
                status = s == null ? "Creator-Code entfernt." : "Du unterstützt jetzt " + s + ". Danke!";
                statusColor = 0xFF55FF55;
            });
        }).exceptionally(e -> fail(e));
    }

    private Void fail(Throwable e) {
        Throwable cause = e.getCause() != null ? e.getCause() : e;
        ui(() -> {
            busy = false;
            status = String.valueOf(cause.getMessage());
            statusColor = 0xFFFF5555;
        });
        return null;
    }

    private void show(String text, int color) {
        status = text;
        statusColor = color;
    }

    /** Auf dem Render-Thread ausführen und die Knöpfe neu aufbauen. */
    private void ui(Runnable r) {
        if (client == null) return;
        client.execute(() -> {
            r.run();
            if (client.currentScreen == this) clearAndInit();
        });
    }

    @Override
    public void render(DrawContext ctx, int mouseX, int mouseY, float delta) {
        super.render(ctx, mouseX, mouseY, delta);
        int cx = width / 2;
        ctx.drawCenteredTextWithShadow(textRenderer, Text.literal("Mythos Shop"), cx, 10, 0xFFB44DFF);
        String head = MythosClient.coins() + " Coins" + (plus() ? " · Plus" : "")
                + " · Creator-Code: " + (supporting == null ? "keiner" : supporting);
        ctx.drawCenteredTextWithShadow(textRenderer, Text.literal(head), cx, 24, 0xFFFFFF55);
        ctx.drawTextWithShadow(textRenderer, Text.literal("Creator unterstützen (zählt bei jedem Kauf):"), cx - 150, 38, 0xFFAAAAAA);

        int y = 48 + 40;
        int from = page * PER_PAGE;
        for (int i = from; i < Math.min(items.size(), from + PER_PAGE); i++) {
            Item item = items.get(i);
            ctx.fill(cx - 150, y, cx + 46, y + 20, 0x66000000);
            ctx.drawTextWithShadow(textRenderer, Text.literal(item.name()), cx - 145, y + 2, 0xFFFFFFFF);
            String info = item.price() > 0
                    ? (owned.contains(item.id()) ? "Gekauft" : item.price() + " Coins")
                    : "Gratis";
            if (item.plusOnly()) info += " · Plus";
            if (item.id().equals(equipped)) info += " · angelegt";
            ctx.drawTextWithShadow(textRenderer, Text.literal(info), cx - 145, y + 11, 0xFFAAAAAA);
            y += 24;
        }
        if (!status.isEmpty()) {
            ctx.drawCenteredTextWithShadow(textRenderer, Text.literal(status), cx, height - 44, statusColor);
        }
        ctx.drawCenteredTextWithShadow(textRenderer,
                Text.literal("NoRisk-Cosmetics gibt es weiter im NoRisk-Shop."), cx, height - 56, 0xFF777777);
    }

    @Override
    public boolean shouldPause() {
        return false;
    }
}
