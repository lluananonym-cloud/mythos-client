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
    public static final String URL = "https://rdxaqiacoitzeowehdts.supabase.co/functions/v1/mcc";
    private static final HttpClient HTTP = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

    private MythosApi() {}

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
