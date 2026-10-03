//! QA-only, non-secret observations of existing handlers. This never authorises
//! an exchange and exposes no new IPC command. A response is not a storage receipt.
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::{fs::OpenOptions, io::Write, path::PathBuf, sync::Mutex};
use tauri::{AppHandle, Manager};
use url::Url;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Callback {
    request_id: String, state_hash: String, callback_hash: String, delivery: String,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Record {
    contract: &'static str, source: String, run_id: String, attempt: String,
    pid: u32, executable_sha256: String, instance: String, sequence: u32,
    device: Option<serde_json::Value>, original: Option<serde_json::Value>,
    callbacks: Vec<Callback>, exchanges: Vec<serde_json::Value>,
}
struct Journal { file: PathBuf, record: Record }
type State = Mutex<Journal>;
fn hash(s: &str) -> String { format!("{:x}", Sha256::digest(s.as_bytes())) }
fn uuid(s: &str) -> bool {
    s.len() == 36 && s.bytes().enumerate().all(|(i,b)|
        if [8,13,18,23].contains(&i) { b == b'-' } else { b.is_ascii_digit() || (b'a'..=b'f').contains(&b) })
}
fn b64(s: &str, n: usize) -> bool { s.len() == n && s.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-') }
pub fn parse_callback(raw: &str, delivery: &str) -> Result<Callback, &'static str> {
    if raw.len() > 2048 || !["COLD_ARGUMENT", "SINGLE_INSTANCE_ARGUMENT"].contains(&delivery) { return Err("QA_CALLBACK_REFUSED"); }
    let u = Url::parse(raw).map_err(|_| "QA_CALLBACK_REFUSED")?;
    let pairs: Vec<_> = u.query_pairs().collect();
    let mut keys: Vec<_> = pairs.iter().map(|p| p.0.as_ref()).collect(); keys.sort();
    if u.scheme() != "nalandaps-erp" || u.host_str() != Some("auth") || u.path() != "/callback"
        || !u.username().is_empty() || u.password().is_some() || u.port().is_some() || u.fragment().is_some()
        || keys != ["code", "request", "state"] { return Err("QA_CALLBACK_REFUSED"); }
    let value = |name: &str| pairs.iter().find(|p| p.0 == name).map(|p| p.1.as_ref()).unwrap_or("");
    if !uuid(value("request")) || !b64(value("state"),43) || !b64(value("code"),43) { return Err("QA_CALLBACK_REFUSED"); }
    Ok(Callback { request_id: value("request").into(), state_hash: hash(value("state")), callback_hash: hash(raw), delivery: delivery.into() })
}
fn update(app: &AppHandle, action: impl FnOnce(&mut Record) -> Result<(), &'static str>) -> Result<(), String> {
    let state = app.try_state::<State>().ok_or("QA_OBSERVER_NOT_INSTALLED")?;
    let mut journal = state.lock().map_err(|_| "QA_OBSERVER_LOCK_FAILED")?;
    action(&mut journal.record).map_err(str::to_string)?;
    journal.record.sequence += 1;
    let bytes = serde_json::to_vec(&journal.record).map_err(|_| "QA_OBSERVER_ENCODING")?;
    if bytes.len() > 16384 { return Err("QA_OBSERVER_BOUND".into()); }
    let temporary=journal.file.with_extension(format!("{}-{}.pending",journal.record.instance,journal.record.sequence));
    let write=|| -> std::io::Result<()> {
        let mut file=OpenOptions::new().write(true).create_new(true).open(&temporary)?;
        file.write_all(&bytes)?;file.sync_all()?;drop(file);
        std::fs::rename(&temporary,&journal.file)
    };
    write().map_err(|_| "QA_OBSERVER_WRITE_FAILED".into())
}
pub fn delivered(app: &AppHandle, args: &[String], delivery: &str) -> Result<(), String> {
    if args.len() != 2 { return Ok(()); }
    let callback = parse_callback(&args[1],delivery).map_err(str::to_string)?;
    update(app, |r| {
        if r.callbacks.len() >= 16 || r.callbacks.iter().any(|c| c.callback_hash == callback.callback_hash) { return Err("QA_CALLBACK_REPLAY"); }
        r.callbacks.push(callback); Ok(())
    })
}
pub fn original(app: &AppHandle, raw: &str) -> Result<(), String> {
    let u = Url::parse(raw).map_err(|_| "QA_ORIGINAL_INVALID")?;
    let get = |key: &str| u.query_pairs().find(|p| p.0 == key).map(|p| p.1.into_owned()).unwrap_or_default();
    let request = get("request"); let state = get("state");
    if !uuid(&request) || !b64(&state,43) { return Err("QA_ORIGINAL_INVALID".into()); }
    update(app, |r| { r.original = Some(serde_json::json!({"requestId":request,"stateHash":hash(&state),"urlHash":hash(raw)})); Ok(()) })
}
pub fn response(app: &AppHandle, path: &str, request: &str, status: u16, response: &str) -> Result<(), String> {
    if !((path == "/api/native-auth/request" && status == 201) || (path == "/api/native-auth/exchange" && status == 200)) { return Ok(()); }
    let req: serde_json::Value = serde_json::from_str(request).map_err(|_| "QA_REQUEST_INVALID")?;
    let res: serde_json::Value = serde_json::from_str(response).map_err(|_| "QA_RESPONSE_INVALID")?;
    let text = |v: &serde_json::Value, key: &str| v.get(key).and_then(|s| s.as_str()).unwrap_or("").to_owned();
    if path.ends_with("/request") {
        let id=text(&req,"publicDeviceId"); let request_id=text(&res,"requestId"); let key=&req["publicSigningKey"];
        let crv=text(key,"crv");let kty=text(key,"kty");let x=text(key,"x");
        if !uuid(&id) || !uuid(&request_id) || crv != "Ed25519" || kty != "OKP" || !b64(&x,43) { return Err("QA_DEVICE_INVALID".into()); }
        // Protocol canonical key order, matching publicJwkHash.
        let canonical=format!("{{\"crv\":\"{}\",\"kty\":\"{}\",\"x\":\"{}\"}}",crv,kty,x);
        update(app,|r| { r.device=Some(serde_json::json!({"publicDeviceId":id,"publicKeyHash":hash(&canonical),"requestId":request_id}));Ok(()) })
    } else {
        let request_id=text(&req,"requestId");let session_id=text(&res,"sessionId");
        if !uuid(&request_id) || !uuid(&session_id) { return Err("QA_EXCHANGE_INVALID".into()); }
        update(app,|r| {
            if r.exchanges.len() >= 16 || !r.callbacks.iter().any(|c| c.request_id == request_id) { return Err("QA_EXCHANGE_WITHOUT_DELIVERY"); }
            r.exchanges.push(serde_json::json!({"requestId":request_id,"sessionId":session_id,"stage":"SERVER_EXCHANGE_RETURNED_NOT_STORAGE_PROOF"}));Ok(())
        })
    }
}
pub fn plugin() -> tauri::plugin::TauriPlugin<tauri::Wry> {
    tauri::plugin::Builder::new("qa-observation")
        .js_init_script(include_str!("qa_privacy.js"))
        .setup(|app, _| {
            let p=super::qa_profile::current().map_err(std::io::Error::other)?.ok_or("QA_PROFILE_REQUIRED")?;
            let dir=app.path().app_data_dir()?; std::fs::create_dir_all(&dir)?;
            let file=dir.join(format!("qa-observation-{}.json",std::process::id()));
            drop(OpenOptions::new().write(true).create_new(true).open(&file)?);
            use ring::rand::{SecureRandom,SystemRandom};let mut nonce=[0u8;16];SystemRandom::new().fill(&mut nonce).map_err(|_| "QA_RANDOM_FAILED")?;
            let exe=std::env::current_exe()?;if std::fs::metadata(&exe)?.len()>256*1024*1024 { return Err("QA_EXECUTABLE_BOUND".into()); }
            let executable_sha256=format!("{:x}",Sha256::digest(std::fs::read(exe)?));
            app.manage(Mutex::new(Journal { file, record:Record { contract:"NALANDA_NATIVE_OBSERVATION_V1",source:p.source,run_id:p.run_id,attempt:p.attempt,pid:std::process::id(),executable_sha256,instance:nonce.iter().map(|b|format!("{b:02x}")).collect(),sequence:0,device:None,original:None,callbacks:vec![],exchanges:vec![] } }));
            update(app, |_| Ok(()))?;
            let args:Vec<String>=std::env::args().collect();
            if args.len()==2 && args[1].starts_with("nalandaps-erp:") { delivered(app,&args,"COLD_ARGUMENT")?; }
            Ok(())
        }).build()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn strict_callback_projection_contains_no_credentials() {
        let raw=format!("nalandaps-erp://auth/callback?request=00000000-0000-4000-8000-000000000001&state={}&code={}","s".repeat(43),"c".repeat(43));
        let c=parse_callback(&raw,"COLD_ARGUMENT").unwrap();let out=serde_json::to_string(&c).unwrap();
        assert!(!out.contains(&"s".repeat(43)));assert!(!out.contains(&"c".repeat(43)));assert!(!out.contains("nalandaps-erp:"));
        for bad in [raw.replace("auth/callback","other/callback"),raw.clone()+"&code=duplicate",raw.clone()+"#fragment",raw.replace("nalandaps-erp:","https:"),raw.replace("00000000-0000","not-a-uuid")] { assert!(parse_callback(&bad,"COLD_ARGUMENT").is_err()); }
        assert!(parse_callback(&raw,"JAVASCRIPT_EVENT").is_err());
    }
}
