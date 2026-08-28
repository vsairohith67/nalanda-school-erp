use argon2::{Algorithm, Argon2, Params, Version};
use reqwest::{
    header::{HeaderMap, HeaderName, HeaderValue},
    redirect::Policy,
    Client,
};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
#[cfg(unix)]
use std::os::unix::fs::OpenOptionsExt;
use std::{
    collections::BTreeMap,
    collections::HashMap,
    fs::OpenOptions,
    io::Write,
    path::{Path, PathBuf},
    str::FromStr,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_opener::OpenerExt;
use url::Url;

const MAX_REQUEST_BYTES: usize = 262_144;
const MAX_RESPONSE_BYTES: usize = 2_097_152;
const STRONGHOLD_SALT_BYTES: usize = 32;
const STRONGHOLD_SNAPSHOT_NAME: &str = "nalanda-native-v1.hold";
const STRONGHOLD_SALT_NAME: &str = "nalanda-native-v1.salt";

#[derive(Clone)]
struct NativeState {
    database_path: PathBuf,
    vault_path: PathBuf,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct VaultSnapshotState {
    path: String,
    exists: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AppProfile {
    name: String,
    origin: Option<String>,
    remote_configured: bool,
    minimum_server_version: String,
    app_version: &'static str,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CachedEnvelope {
    record_id: String,
    record_type: String,
    nonce: String,
    ciphertext: String,
    aad_hash: String,
    updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
enum NativeApiOperation {
    AuthRequest,
    AuthExchange,
    AuthRefresh,
    Context,
    ReferencePack,
    Sync,
    Conflicts,
    Logout,
}

impl NativeApiOperation {
    fn path(&self) -> &'static str {
        match self {
            Self::AuthRequest => "/api/native-auth/request",
            Self::AuthExchange => "/api/native-auth/exchange",
            Self::AuthRefresh => "/api/native-auth/refresh",
            Self::Context => "/api/native/v1/context",
            Self::ReferencePack => "/api/native/v1/reference-pack",
            Self::Sync => "/api/native/v1/sync",
            Self::Conflicts => "/api/native/v1/conflicts",
            Self::Logout => "/api/native-auth/logout",
        }
    }

    fn method(&self) -> reqwest::Method {
        match self {
            Self::Context | Self::ReferencePack | Self::Conflicts => reqwest::Method::GET,
            _ => reqwest::Method::POST,
        }
    }
}

#[derive(Debug, Serialize)]
struct NativeApiResponse {
    status: u16,
    body: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct UnlockGuardState {
    failed_attempts: u32,
    retry_after_seconds: u64,
}

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
enum DiagnosticEvent {
    VaultLocked,
    UnlockFailed,
    UnlockBlocked,
    AuthorizationFailed,
    ReferenceRefreshed,
    ReferenceRefreshFailed,
    SyncAccepted,
    SyncConflict,
    SyncRejected,
    SyncRetryLater,
    DeviceRevoked,
    LocalWipe,
}

impl DiagnosticEvent {
    fn code(self) -> &'static str {
        match self {
            Self::VaultLocked => "VAULT_LOCKED",
            Self::UnlockFailed => "UNLOCK_FAILED",
            Self::UnlockBlocked => "UNLOCK_BLOCKED",
            Self::AuthorizationFailed => "AUTHORIZATION_FAILED",
            Self::ReferenceRefreshed => "REFERENCE_REFRESHED",
            Self::ReferenceRefreshFailed => "REFERENCE_REFRESH_FAILED",
            Self::SyncAccepted => "SYNC_ACCEPTED",
            Self::SyncConflict => "SYNC_CONFLICT",
            Self::SyncRejected => "SYNC_REJECTED",
            Self::SyncRetryLater => "SYNC_RETRY_LATER",
            Self::DeviceRevoked => "DEVICE_REVOKED",
            Self::LocalWipe => "LOCAL_WIPE",
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DiagnosticLogEntry {
    occurred_at_epoch: u64,
    safe_error_code: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DiagnosticExport {
    schema_version: u8,
    app_version: &'static str,
    platform: &'static str,
    generated_at_epoch: u64,
    sync_state_counts: BTreeMap<String, u32>,
    safe_events: Vec<DiagnosticLogEntry>,
}

fn configured_profile() -> AppProfile {
    let name = option_env!("NALANDA_NATIVE_PROFILE").unwrap_or("NO_REMOTE_SERVER_CONFIGURED");
    let origin = match name {
        "LOCAL_DEVELOPMENT" => option_env!("NALANDA_NATIVE_LOCAL_ORIGIN"),
        "PRIVATE_STAGING" => option_env!("NALANDA_NATIVE_STAGING_ORIGIN"),
        "PRODUCTION" => option_env!("NALANDA_NATIVE_PRODUCTION_ORIGIN"),
        _ => None,
    }
    .and_then(normalize_origin);
    AppProfile {
        name: name.to_string(),
        remote_configured: origin.is_some(),
        minimum_server_version: option_env!("NALANDA_NATIVE_MINIMUM_SERVER_VERSION")
            .unwrap_or("0.1.0")
            .to_string(),
        app_version: env!("CARGO_PKG_VERSION"),
        origin,
    }
}

fn normalize_origin(raw: &str) -> Option<String> {
    let url = Url::parse(raw).ok()?;
    let local_http =
        url.scheme() == "http" && matches!(url.host_str(), Some("127.0.0.1") | Some("localhost"));
    if url.scheme() != "https" && !local_http {
        return None;
    }
    if url.username() != ""
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
        || url.path() != "/"
    {
        return None;
    }
    Some(url.origin().ascii_serialization())
}

fn allowed_authorization_url(raw: &str) -> bool {
    let Some(origin) = configured_profile().origin else {
        return false;
    };
    let Ok(url) = Url::parse(raw) else {
        return false;
    };
    url.origin().ascii_serialization() == origin
        && url.path() == "/native/authorize"
        && url.fragment().is_none()
}

fn allowed_online_navigation(url: &Url) -> bool {
    let Some(origin) = configured_profile().origin else {
        return false;
    };
    url.origin().ascii_serialization() == origin
        && !url.path().starts_with("/api/")
        && !url.path().starts_with("/_next/webpack-hmr")
}

fn validate_token(value: &str, min: usize, max: usize) -> Result<(), String> {
    if value.len() < min
        || value.len() > max
        || !value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b':' | b'.'))
    {
        return Err("CACHE_METADATA_INVALID".into());
    }
    Ok(())
}

fn initialize_cache(path: &Path) -> Result<(), String> {
    let connection = Connection::open(path).map_err(|_| "CACHE_OPEN_FAILED")?;
    connection
    .execute_batch(
      "PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON;
       CREATE TABLE IF NOT EXISTS encrypted_cache (
         record_id TEXT PRIMARY KEY NOT NULL,
         record_type TEXT NOT NULL,
         nonce TEXT NOT NULL,
         ciphertext TEXT NOT NULL,
         aad_hash TEXT NOT NULL,
         updated_at TEXT NOT NULL
       );
       CREATE INDEX IF NOT EXISTS encrypted_cache_type_updated ON encrypted_cache(record_type, updated_at);
       CREATE TABLE IF NOT EXISTS unlock_guard (
         singleton INTEGER PRIMARY KEY CHECK(singleton = 1),
         failed_attempts INTEGER NOT NULL CHECK(failed_attempts >= 0),
         blocked_until_epoch INTEGER NOT NULL CHECK(blocked_until_epoch >= 0)
       );
       INSERT OR IGNORE INTO unlock_guard(singleton, failed_attempts, blocked_until_epoch) VALUES (1, 0, 0);
       CREATE TABLE IF NOT EXISTS diagnostic_log (
         sequence INTEGER PRIMARY KEY AUTOINCREMENT,
         occurred_at_epoch INTEGER NOT NULL CHECK(occurred_at_epoch >= 0),
         event_code TEXT NOT NULL CHECK(length(event_code) BETWEEN 3 AND 48)
       );
       CREATE INDEX IF NOT EXISTS diagnostic_log_occurred ON diagnostic_log(occurred_at_epoch);",
    )
    .map_err(|_| "CACHE_SCHEMA_FAILED")?;
    Ok(())
}

fn read_stronghold_salt(path: &Path) -> Result<[u8; STRONGHOLD_SALT_BYTES], String> {
    let bytes = std::fs::read(path).map_err(|_| "STRONGHOLD_SALT_READ_FAILED")?;
    bytes
        .try_into()
        .map_err(|_| "STRONGHOLD_SALT_INVALID".to_string())
}

fn prepare_stronghold_salt(
    path: &Path,
    vault_path: &Path,
) -> Result<[u8; STRONGHOLD_SALT_BYTES], String> {
    if path.is_file() {
        return read_stronghold_salt(path);
    }
    if vault_path.exists() {
        return Err("STRONGHOLD_SALT_MISSING_FOR_EXISTING_VAULT".into());
    }
    let mut salt = [0_u8; STRONGHOLD_SALT_BYTES];
    getrandom::fill(&mut salt).map_err(|_| "STRONGHOLD_SALT_GENERATION_FAILED")?;
    let mut options = OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    options.mode(0o600);
    match options.open(path) {
        Ok(mut file) => {
            file.write_all(&salt)
                .map_err(|_| "STRONGHOLD_SALT_WRITE_FAILED")?;
            file.sync_all()
                .map_err(|_| "STRONGHOLD_SALT_WRITE_FAILED")?;
            Ok(salt)
        }
        Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {
            read_stronghold_salt(path)
        }
        Err(_) => Err("STRONGHOLD_SALT_WRITE_FAILED".into()),
    }
}

#[tauri::command]
fn app_profile() -> AppProfile {
    configured_profile()
}

#[tauri::command]
fn vault_snapshot_state(state: tauri::State<'_, NativeState>) -> VaultSnapshotState {
    VaultSnapshotState {
        path: state.vault_path.to_string_lossy().into_owned(),
        exists: state.vault_path.is_file(),
    }
}

#[tauri::command]
fn cache_put(state: tauri::State<'_, NativeState>, envelope: CachedEnvelope) -> Result<(), String> {
    validate_token(&envelope.record_id, 8, 160)?;
    validate_token(&envelope.record_type, 3, 64)?;
    if envelope.nonce.len() > 64
        || envelope.ciphertext.len() < 24
        || envelope.ciphertext.len() > 1_400_000
        || envelope.aad_hash.len() != 64
        || envelope.updated_at.len() > 40
    {
        return Err("CACHE_ENVELOPE_INVALID".into());
    }
    let connection = Connection::open(&state.database_path).map_err(|_| "CACHE_OPEN_FAILED")?;
    connection
    .execute(
      "INSERT INTO encrypted_cache(record_id, record_type, nonce, ciphertext, aad_hash, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
       ON CONFLICT(record_id) DO UPDATE SET record_type=excluded.record_type, nonce=excluded.nonce, ciphertext=excluded.ciphertext, aad_hash=excluded.aad_hash, updated_at=excluded.updated_at",
      params![
        envelope.record_id,
        envelope.record_type,
        envelope.nonce,
        envelope.ciphertext,
        envelope.aad_hash,
        envelope.updated_at
      ],
    )
    .map_err(|_| "CACHE_WRITE_FAILED")?;
    Ok(())
}

#[tauri::command]
fn cache_list(
    state: tauri::State<'_, NativeState>,
    record_type: String,
) -> Result<Vec<CachedEnvelope>, String> {
    validate_token(&record_type, 3, 64)?;
    let connection = Connection::open(&state.database_path).map_err(|_| "CACHE_OPEN_FAILED")?;
    let mut statement = connection
    .prepare("SELECT record_id, record_type, nonce, ciphertext, aad_hash, updated_at FROM encrypted_cache WHERE record_type = ?1 ORDER BY updated_at DESC LIMIT 500")
    .map_err(|_| "CACHE_READ_FAILED")?;
    let rows = statement
        .query_map([record_type], |row| {
            Ok(CachedEnvelope {
                record_id: row.get(0)?,
                record_type: row.get(1)?,
                nonce: row.get(2)?,
                ciphertext: row.get(3)?,
                aad_hash: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })
        .map_err(|_| "CACHE_READ_FAILED")?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|_| "CACHE_READ_FAILED".into())
}

#[tauri::command]
fn cache_delete(state: tauri::State<'_, NativeState>, record_id: String) -> Result<(), String> {
    validate_token(&record_id, 8, 160)?;
    Connection::open(&state.database_path)
        .map_err(|_| "CACHE_OPEN_FAILED")?
        .execute(
            "DELETE FROM encrypted_cache WHERE record_id = ?1",
            [record_id],
        )
        .map_err(|_| "CACHE_DELETE_FAILED")?;
    Ok(())
}

#[tauri::command]
fn cache_reset(state: tauri::State<'_, NativeState>, confirmation: String) -> Result<(), String> {
    if confirmation != "ERASE LOCAL DRAFTS" {
        return Err("CACHE_RESET_CONFIRMATION_REQUIRED".into());
    }
    Connection::open(&state.database_path)
        .map_err(|_| "CACHE_OPEN_FAILED")?
        .execute("DELETE FROM encrypted_cache", [])
        .map_err(|_| "CACHE_RESET_FAILED")?;
    record_diagnostic(&state.database_path, DiagnosticEvent::LocalWipe)?;
    Ok(())
}

fn epoch_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn record_diagnostic(path: &Path, event: DiagnosticEvent) -> Result<(), String> {
    let now = epoch_seconds();
    let retention_floor = now.saturating_sub(7 * 24 * 60 * 60) as i64;
    let connection = Connection::open(path).map_err(|_| "CACHE_OPEN_FAILED")?;
    let transaction = connection
        .unchecked_transaction()
        .map_err(|_| "DIAGNOSTIC_WRITE_FAILED")?;
    transaction
        .execute(
            "DELETE FROM diagnostic_log WHERE occurred_at_epoch < ?1",
            [retention_floor],
        )
        .map_err(|_| "DIAGNOSTIC_WRITE_FAILED")?;
    transaction
        .execute(
            "INSERT INTO diagnostic_log(occurred_at_epoch, event_code) VALUES (?1, ?2)",
            params![now as i64, event.code()],
        )
        .map_err(|_| "DIAGNOSTIC_WRITE_FAILED")?;
    transaction
        .execute(
            "DELETE FROM diagnostic_log WHERE sequence NOT IN (SELECT sequence FROM diagnostic_log ORDER BY sequence DESC LIMIT 500)",
            [],
        )
        .map_err(|_| "DIAGNOSTIC_WRITE_FAILED")?;
    transaction
        .commit()
        .map_err(|_| "DIAGNOSTIC_WRITE_FAILED")?;
    Ok(())
}

#[tauri::command]
fn diagnostic_record(
    state: tauri::State<'_, NativeState>,
    event: DiagnosticEvent,
) -> Result<(), String> {
    record_diagnostic(&state.database_path, event)
}

#[tauri::command]
fn diagnostic_export(state: tauri::State<'_, NativeState>) -> Result<DiagnosticExport, String> {
    let connection = Connection::open(&state.database_path).map_err(|_| "CACHE_OPEN_FAILED")?;
    let mut statement = connection
        .prepare("SELECT occurred_at_epoch, event_code FROM diagnostic_log ORDER BY sequence DESC LIMIT 500")
        .map_err(|_| "DIAGNOSTIC_READ_FAILED")?;
    let safe_events: Vec<DiagnosticLogEntry> = statement
        .query_map([], |row| {
            let occurred_at_epoch: i64 = row.get(0)?;
            Ok(DiagnosticLogEntry {
                occurred_at_epoch: occurred_at_epoch.max(0) as u64,
                safe_error_code: row.get(1)?,
            })
        })
        .map_err(|_| "DIAGNOSTIC_READ_FAILED")?
        .collect::<Result<_, _>>()
        .map_err(|_| "DIAGNOSTIC_READ_FAILED")?;
    let mut sync_state_counts = BTreeMap::new();
    for entry in &safe_events {
        if entry.safe_error_code.starts_with("SYNC_") || entry.safe_error_code == "DEVICE_REVOKED" {
            *sync_state_counts
                .entry(entry.safe_error_code.clone())
                .or_insert(0) += 1;
        }
    }
    Ok(DiagnosticExport {
        schema_version: 1,
        app_version: env!("CARGO_PKG_VERSION"),
        platform: std::env::consts::OS,
        generated_at_epoch: epoch_seconds(),
        sync_state_counts,
        safe_events,
    })
}

fn read_unlock_guard(path: &Path) -> Result<UnlockGuardState, String> {
    let now = epoch_seconds();
    let connection = Connection::open(path).map_err(|_| "CACHE_OPEN_FAILED")?;
    let (failed_attempts, blocked_until): (u32, i64) = connection
        .query_row(
            "SELECT failed_attempts, blocked_until_epoch FROM unlock_guard WHERE singleton = 1",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|_| "UNLOCK_GUARD_READ_FAILED")?;
    Ok(UnlockGuardState {
        failed_attempts,
        retry_after_seconds: (blocked_until.max(0) as u64).saturating_sub(now),
    })
}

#[tauri::command]
fn unlock_guard_status(state: tauri::State<'_, NativeState>) -> Result<UnlockGuardState, String> {
    read_unlock_guard(&state.database_path)
}

#[tauri::command]
fn unlock_guard_record_failure(
    state: tauri::State<'_, NativeState>,
) -> Result<UnlockGuardState, String> {
    let now = epoch_seconds();
    let connection = Connection::open(&state.database_path).map_err(|_| "CACHE_OPEN_FAILED")?;
    let failed_attempts: u32 = connection
        .query_row(
            "SELECT failed_attempts FROM unlock_guard WHERE singleton = 1",
            [],
            |row| row.get(0),
        )
        .map_err(|_| "UNLOCK_GUARD_READ_FAILED")?;
    let next = failed_attempts.saturating_add(1);
    let delay = if next < 5 {
        0
    } else {
        30_u64
            .saturating_mul(2_u64.saturating_pow(next.saturating_sub(5).min(4)))
            .min(300)
    };
    connection
        .execute(
            "UPDATE unlock_guard SET failed_attempts = ?1, blocked_until_epoch = ?2 WHERE singleton = 1",
            params![next, now.saturating_add(delay) as i64],
        )
        .map_err(|_| "UNLOCK_GUARD_WRITE_FAILED")?;
    record_diagnostic(
        &state.database_path,
        if delay > 0 {
            DiagnosticEvent::UnlockBlocked
        } else {
            DiagnosticEvent::UnlockFailed
        },
    )?;
    read_unlock_guard(&state.database_path)
}

#[tauri::command]
fn unlock_guard_clear(state: tauri::State<'_, NativeState>) -> Result<(), String> {
    Connection::open(&state.database_path)
        .map_err(|_| "CACHE_OPEN_FAILED")?
        .execute(
            "UPDATE unlock_guard SET failed_attempts = 0, blocked_until_epoch = 0 WHERE singleton = 1",
            [],
        )
        .map_err(|_| "UNLOCK_GUARD_WRITE_FAILED")?;
    Ok(())
}

#[tauri::command]
async fn native_api_request(
    operation: NativeApiOperation,
    body: Option<String>,
    headers: HashMap<String, String>,
) -> Result<NativeApiResponse, String> {
    let origin = configured_profile()
        .origin
        .ok_or_else(|| "REMOTE_SERVER_NOT_CONFIGURED".to_string())?;
    let body = body.unwrap_or_default();
    if body.len() > MAX_REQUEST_BYTES {
        return Err("REQUEST_TOO_LARGE".into());
    }
    let mut safe_headers = HeaderMap::new();
    for (name, value) in headers {
        let lower = name.to_ascii_lowercase();
        if lower != "authorization"
            && !lower.starts_with("x-offline-")
            && !matches!(
                lower.as_str(),
                "x-native-session"
                    | "x-native-device-id"
                    | "x-native-timestamp"
                    | "x-native-nonce"
                    | "x-native-body-sha256"
                    | "x-native-signature"
            )
        {
            return Err("HEADER_NOT_ALLOWED".into());
        }
        if value.len() > 4096 || value.contains(['\r', '\n']) {
            return Err("HEADER_INVALID".into());
        }
        safe_headers.insert(
            HeaderName::from_str(&lower).map_err(|_| "HEADER_INVALID")?,
            HeaderValue::from_str(&value).map_err(|_| "HEADER_INVALID")?,
        );
    }
    let url = format!("{}{}", origin, operation.path());
    let client = Client::builder()
        .redirect(Policy::none())
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|_| "NETWORK_SETUP_FAILED")?;
    let mut request = client
        .request(operation.method(), url)
        .headers(safe_headers)
        .header("accept", "application/json");
    if !body.is_empty() {
        request = request
            .header("content-type", "application/json")
            .body(body);
    }
    let mut response = request.send().await.map_err(|_| "NETWORK_REQUEST_FAILED")?;
    if response.status().is_redirection() {
        return Err("NETWORK_REDIRECT_REJECTED".into());
    }
    let status = response.status().as_u16();
    if response
        .content_length()
        .is_some_and(|length| length > MAX_RESPONSE_BYTES as u64)
    {
        return Err("NETWORK_RESPONSE_TOO_LARGE".into());
    }
    let mut bytes = Vec::with_capacity(
        response
            .content_length()
            .unwrap_or_default()
            .min(MAX_RESPONSE_BYTES as u64) as usize,
    );
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| "NETWORK_RESPONSE_FAILED")?
    {
        append_bounded_response_chunk(&mut bytes, &chunk)?;
    }
    let body = String::from_utf8(bytes).map_err(|_| "NETWORK_RESPONSE_INVALID")?;
    Ok(NativeApiResponse { status, body })
}

fn append_bounded_response_chunk(buffer: &mut Vec<u8>, chunk: &[u8]) -> Result<(), String> {
    if chunk.len() > MAX_RESPONSE_BYTES.saturating_sub(buffer.len()) {
        return Err("NETWORK_RESPONSE_TOO_LARGE".into());
    }
    buffer.extend_from_slice(chunk);
    Ok(())
}

#[tauri::command]
fn open_authorization(app: AppHandle, url: String) -> Result<(), String> {
    if !allowed_authorization_url(&url) {
        return Err("AUTHORIZATION_URL_NOT_ALLOWED".into());
    }
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|_| "AUTHORIZATION_OPEN_FAILED".into())
}

#[tauri::command]
fn open_online_erp(app: AppHandle) -> Result<(), String> {
    let origin = configured_profile()
        .origin
        .ok_or_else(|| "REMOTE_SERVER_NOT_CONFIGURED".to_string())?;
    if let Some(existing) = app.get_webview_window("online-erp") {
        existing
            .set_focus()
            .map_err(|_| "ONLINE_ERP_FOCUS_FAILED")?;
        return Ok(());
    }
    let url = Url::parse(&origin).map_err(|_| "REMOTE_ORIGIN_INVALID")?;
    WebviewWindowBuilder::new(&app, "online-erp", WebviewUrl::External(url))
        .title("Nalanda School Management System · Online")
        .on_navigation(allowed_online_navigation)
        .build()
        .map_err(|_| "ONLINE_ERP_OPEN_FAILED")?;
    Ok(())
}

fn derive_stronghold_key(password: &str, salt: &[u8; STRONGHOLD_SALT_BYTES]) -> Vec<u8> {
    let params = Params::new(65_536, 3, 1, Some(32)).expect("valid Argon2 parameters");
    let argon = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let mut key = vec![0u8; 32];
    argon
        .hash_password_into(password.as_bytes(), salt, &mut key)
        .expect("Argon2 key derivation failed");
    key
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();
    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, _, _| {
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.set_focus();
        }
    }));
    builder
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let data_dir = app
                .path()
                .app_data_dir()
                .map_err(|error| format!("app data directory unavailable: {error}"))?;
            std::fs::create_dir_all(&data_dir)?;
            let database_path = data_dir.join("native-cache-v1.sqlite3");
            let vault_path = data_dir.join(STRONGHOLD_SNAPSHOT_NAME);
            let salt_path = data_dir.join(STRONGHOLD_SALT_NAME);
            let salt =
                prepare_stronghold_salt(&salt_path, &vault_path).map_err(std::io::Error::other)?;
            app.handle().plugin(
                tauri_plugin_stronghold::Builder::new(move |password| {
                    derive_stronghold_key(password, &salt)
                })
                .build(),
            )?;
            initialize_cache(&database_path).map_err(std::io::Error::other)?;
            app.manage(NativeState {
                database_path,
                vault_path,
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            app_profile,
            vault_snapshot_state,
            cache_put,
            cache_list,
            cache_delete,
            cache_reset,
            unlock_guard_status,
            unlock_guard_record_failure,
            unlock_guard_clear,
            diagnostic_record,
            diagnostic_export,
            native_api_request,
            open_authorization,
            open_online_erp
        ])
        .run(tauri::generate_context!())
        .expect("error while running Nalanda School app");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn profile_origins_fail_closed() {
        assert_eq!(
            normalize_origin("https://erp.example.test"),
            Some("https://erp.example.test".into())
        );
        assert_eq!(
            normalize_origin("http://127.0.0.1:3000"),
            Some("http://127.0.0.1:3000".into())
        );
        assert_eq!(normalize_origin("http://erp.example.test"), None);
        assert_eq!(normalize_origin("https://user@erp.example.test"), None);
        assert_eq!(normalize_origin("https://erp.example.test/path"), None);
    }

    #[test]
    fn cache_stores_only_ciphertext_envelopes() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("cache.sqlite3");
        initialize_cache(&path).unwrap();
        let connection = Connection::open(path).unwrap();
        let mut statement = connection
            .prepare("PRAGMA table_info(encrypted_cache)")
            .unwrap();
        let columns: Vec<String> = statement
            .query_map([], |row| row.get(1))
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();
        assert_eq!(
            columns,
            vec![
                "record_id",
                "record_type",
                "nonce",
                "ciphertext",
                "aad_hash",
                "updated_at"
            ]
        );
        assert!(!columns
            .iter()
            .any(|column| matches!(column.as_str(), "student_name" | "amount" | "payload")));
    }

    #[test]
    fn unlock_failures_back_off_after_five_attempts() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("cache.sqlite3");
        initialize_cache(&path).unwrap();
        let connection = Connection::open(&path).unwrap();
        connection
            .execute(
                "UPDATE unlock_guard SET failed_attempts = 5, blocked_until_epoch = ?1 WHERE singleton = 1",
                [(epoch_seconds() + 30) as i64],
            )
            .unwrap();
        let guard = read_unlock_guard(&path).unwrap();
        assert_eq!(guard.failed_attempts, 5);
        assert!(guard.retry_after_seconds > 0 && guard.retry_after_seconds <= 30);
    }

    #[test]
    fn diagnostics_are_bounded_and_payload_free() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("cache.sqlite3");
        initialize_cache(&path).unwrap();
        for _ in 0..510 {
            record_diagnostic(&path, DiagnosticEvent::SyncRetryLater).unwrap();
        }
        let connection = Connection::open(path).unwrap();
        let count: u32 = connection
            .query_row("SELECT COUNT(*) FROM diagnostic_log", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 500);
        let columns: Vec<String> = connection
            .prepare("PRAGMA table_info(diagnostic_log)")
            .unwrap()
            .query_map([], |row| row.get(1))
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();
        assert_eq!(columns, vec!["sequence", "occurred_at_epoch", "event_code"]);
    }

    #[test]
    fn custom_scheme_never_becomes_a_remote_origin() {
        assert_eq!(normalize_origin("nalandaps-erp://auth/callback"), None);
    }

    #[test]
    fn installation_salts_are_stable_unique_and_fail_closed() {
        let first = tempfile::tempdir().unwrap();
        let second = tempfile::tempdir().unwrap();
        let first_salt_path = first.path().join(STRONGHOLD_SALT_NAME);
        let first_vault_path = first.path().join(STRONGHOLD_SNAPSHOT_NAME);
        let second_salt_path = second.path().join(STRONGHOLD_SALT_NAME);
        let second_vault_path = second.path().join(STRONGHOLD_SNAPSHOT_NAME);
        let first_salt = prepare_stronghold_salt(&first_salt_path, &first_vault_path).unwrap();
        let reopened_salt = prepare_stronghold_salt(&first_salt_path, &first_vault_path).unwrap();
        let second_salt = prepare_stronghold_salt(&second_salt_path, &second_vault_path).unwrap();
        assert_eq!(first_salt, reopened_salt);
        assert_ne!(first_salt, second_salt);
        assert_eq!(
            derive_stronghold_key("12345678", &first_salt),
            derive_stronghold_key("12345678", &reopened_salt)
        );
        assert_ne!(
            derive_stronghold_key("12345678", &first_salt),
            derive_stronghold_key("12345678", &second_salt)
        );

        let missing = tempfile::tempdir().unwrap();
        let missing_vault = missing.path().join(STRONGHOLD_SNAPSHOT_NAME);
        std::fs::write(&missing_vault, b"synthetic-vault").unwrap();
        assert_eq!(
            prepare_stronghold_salt(&missing.path().join(STRONGHOLD_SALT_NAME), &missing_vault),
            Err("STRONGHOLD_SALT_MISSING_FOR_EXISTING_VAULT".into())
        );
    }

    #[test]
    fn response_chunks_are_bounded_before_extension() {
        let mut bytes = vec![0_u8; MAX_RESPONSE_BYTES - 1];
        append_bounded_response_chunk(&mut bytes, &[1]).unwrap();
        let before = bytes.len();
        assert_eq!(
            append_bounded_response_chunk(&mut bytes, &[2]),
            Err("NETWORK_RESPONSE_TOO_LARGE".into())
        );
        assert_eq!(bytes.len(), before);
    }
}
