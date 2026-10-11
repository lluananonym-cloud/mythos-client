//! Mythos-Backend (Supabase Edge Function "mcc"): Anmeldung über das aktive Minecraft-Konto.
use crate::config::HTTP_CLIENT;
use crate::error::{AppError, CommandError};
use crate::minecraft::api::mc_api::MinecraftApiService;
use crate::state::state_manager::State;
use rand::RngCore;
use serde_json::{json, Value};

/// Fallback, falls beim Build kein eigener Mythos-Server gefunden wurde (Supabase der Website).
const FALLBACK_API_URL: &str = "https://rdxaqiacoitzeowehdts.supabase.co/functions/v1/mcc";

/// Adresse der Edge Function; der CI-Build setzt MYTHOS_API_URL auf das eigene Supabase-Projekt.
fn api_url() -> &'static str {
    match option_env!("MYTHOS_API_URL") {
        Some(url) if !url.is_empty() => url,
        _ => FALLBACK_API_URL,
    }
}

/// Meldet das aktive Minecraft-Konto beim Mythos-Backend an, ohne Passwort:
/// joinServer bei Mojang mit zufälliger serverId, das Backend prüft das per hasJoined.
/// Gibt `{ token, expiresAt, profile }` zurück.
#[tauri::command]
pub async fn mythos_login() -> Result<Value, CommandError> {
    let state = State::get().await?;
    let account = state
        .minecraft_account_manager_v2
        .get_active_account()
        .await?
        .ok_or_else(|| AppError::AccountError("Kein Minecraft-Konto angemeldet".to_string()))?;

    let mut random = [0u8; 16];
    rand::thread_rng().fill_bytes(&mut random);
    let server_id = hex::encode(random);

    MinecraftApiService::new()
        .join_server_session(
            &account.access_token,
            &account.id.to_string().replace("-", ""),
            &server_id,
        )
        .await?;

    post(json!({ "action": "session", "username": account.username, "serverId": server_id }), None).await
}

/// Ruft eine Aktion der Edge Function auf. Läuft über Rust statt fetch im Webview,
/// damit CORS und CSP keine Rolle spielen.
#[tauri::command]
pub async fn mythos_api(
    action: String,
    body: Option<Value>,
    token: Option<String>,
) -> Result<Value, CommandError> {
    let mut payload = match body {
        Some(Value::Object(map)) => Value::Object(map),
        _ => json!({}),
    };
    payload["action"] = Value::String(action);
    post(payload, token).await
}

async fn post(payload: Value, token: Option<String>) -> Result<Value, CommandError> {
    let mut request = HTTP_CLIENT.post(api_url()).json(&payload);
    if let Some(token) = token {
        request = request.bearer_auth(token);
    }
    let response = request.send().await.map_err(|e| {
        AppError::AccountError(format!("Mythos-Server nicht erreichbar ({})", e))
    })?;
    let status = response.status();
    let text = response.text().await.unwrap_or_default();
    let body: Value = serde_json::from_str(&text).unwrap_or(Value::Null);
    if status.is_success() {
        return Ok(body);
    }
    let message = match body.get("error").and_then(Value::as_str) {
        Some(m) => m.to_string(),
        None if status.as_u16() == 404 => {
            "Mythos-Server ist noch nicht online: die Edge Function \"mcc\" ist nicht deployt".to_string()
        }
        None => body
            .get("message")
            .and_then(Value::as_str)
            .map(str::to_string)
            .unwrap_or_else(|| format!("Mythos-Server antwortet mit Fehler {}", status.as_u16())),
    };
    Err(AppError::AccountError(message).into())
}
