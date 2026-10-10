//! Mythos-Backend (Supabase Edge Function "mcc"): Anmeldung über das aktive Minecraft-Konto.
use crate::config::HTTP_CLIENT;
use crate::error::{AppError, CommandError};
use crate::minecraft::api::mc_api::MinecraftApiService;
use crate::state::state_manager::State;
use rand::RngCore;
use serde_json::{json, Value};

pub const MYTHOS_API_URL: &str = "https://rdxaqiacoitzeowehdts.supabase.co/functions/v1/mcc";

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

    let response = HTTP_CLIENT
        .post(MYTHOS_API_URL)
        .json(&json!({ "action": "session", "username": account.username, "serverId": server_id }))
        .send()
        .await
        .map_err(AppError::MinecraftApi)?;
    let status = response.status();
    let body: Value = response.json().await.map_err(AppError::MinecraftApi)?;
    if !status.is_success() {
        let message = body
            .get("error")
            .and_then(Value::as_str)
            .unwrap_or("Mythos-Anmeldung fehlgeschlagen");
        return Err(AppError::AccountError(message.to_string()).into());
    }
    Ok(body)
}
