package gg.mythoscraft.client;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Collection;
import java.util.concurrent.CompletableFuture;

/** Spricht mit dem Mythos-Backend (Supabase Edge Function "mcc"). */
public final class MythosApi {
    /** Fallback, falls beim Build kein eigener Mythos-Server eingetragen wurde. */
    private static final String FALLBACK_URL = "https://rdxaqiacoitzeowehdts.supabase.co/functions/v1/mcc";
    /** Der CI-Build schreibt die Adresse des eigenen Servers in mythos.properties. */
    public static final String URL = loadUrl();
    private static final HttpClient HTTP = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

    private MythosApi() {}

    private static String loadUrl() {
        try (java.io.InputStream in = MythosApi.class.getResourceAsStream("/mythos.properties")) {
            if (in != null) {
                java.util.Properties props = new java.util.Properties();
                props.load(in);
                String url = props.getProperty("api.url", "").trim();
                if (!url.isEmpty()) return url;
            }
        } catch (java.io.IOException ignored) {
        }
        return FALLBACK_URL;
    }

    public static CompletableFuture<JsonObject> call(String action, JsonObject body, String token) {
        body.addProperty("action", action);
        HttpRequest.Builder req = HttpRequest.newBuilder(URI.create(URL))
                .timeout(Duration.ofSeconds(15))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body.toString()));
        if (token != null) req.header("Authorization", "Bearer " + token);
        return HTTP.sendAsync(req.build(), HttpResponse.BodyHandlers.ofString()).thenApply(res -> {
            JsonObject json = JsonParser.parseString(res.body()).getAsJsonObject();
            if (res.statusCode() >= 400) {
                String error = json.has("error") ? json.get("error").getAsString() : "Fehler " + res.statusCode();
                throw new IllegalStateException(error);
            }
            return json;
        });
    }

    /** Wie Minecrafts joinServer: meldet bei Mojang, dass dieses Konto der serverId beitritt (für hasJoined im Backend). */
    public static void joinServer(String accessToken, String uuidNoDashes, String serverId) throws Exception {
        JsonObject body = new JsonObject();
        body.addProperty("accessToken", accessToken);
        body.addProperty("selectedProfile", uuidNoDashes);
        body.addProperty("serverId", serverId);
        HttpRequest req = HttpRequest.newBuilder(URI.create("https://sessionserver.mojang.com/session/minecraft/join"))
                .timeout(Duration.ofSeconds(15))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body.toString()))
                .build();
        HttpResponse<String> res = HTTP.send(req, HttpResponse.BodyHandlers.ofString());
        if (res.statusCode() >= 300) throw new IllegalStateException("Mojang join: " + res.statusCode());
    }

    public static CompletableFuture<JsonObject> session(String username, String serverId) {
        JsonObject body = new JsonObject();
        body.addProperty("username", username);
        body.addProperty("serverId", serverId);
        return call("session", body, null);
    }

    public static CompletableFuture<JsonObject> give(String token, int amount) {
        JsonObject body = new JsonObject();
        body.addProperty("amount", amount);
        return call("give", body, token);
    }

    public static CompletableFuture<JsonObject> profile(String token) {
        return call("profile", new JsonObject(), token);
    }

    public static CompletableFuture<JsonObject> players(Collection<String> uuids) {
        JsonObject body = new JsonObject();
        JsonArray arr = new JsonArray();
        uuids.forEach(arr::add);
        body.add("uuids", arr);
        return call("players", body, null);
    }
}
