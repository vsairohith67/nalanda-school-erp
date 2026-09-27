//! Separate build-time public QA trust. No runtime URL, key, CA, or flag override.
use base64::{
    engine::general_purpose::{STANDARD, URL_SAFE_NO_PAD},
    Engine,
};
use ring::signature::{UnparsedPublicKey, ED25519};
use serde::Deserialize;
use sha2::{Digest, Sha256};
#[cfg(feature = "synthetic-qa")]
use std::time::{SystemTime, UNIX_EPOCH};

pub const PATHS: [&str; 6] = [
    "/api/native-auth/request",
    "/api/native-auth/exchange",
    "/api/native-auth/refresh",
    "/api/native/v1/context",
    "/api/native/v1/reference-pack",
    "/api/native-auth/logout",
];
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Envelope {
    payload: String,
    signature: String,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Trust {
    contract: String,
    build_id: String,
    source: String,
    run_id: String,
    attempt: String,
    public_key: String,
}
#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Profile {
    contract: String,
    source: String,
    run_id: String,
    attempt: String,
    build_id: String,
    native_build_id: String,
    database_sha256: String,
    pub origin: String,
    environment: String,
    phase: String,
    app_id: String,
    architecture: String,
    issued_at: u64,
    expires_at: u64,
    pub ca_pem: String,
    ca_sha256: String,
    paths: Vec<String>,
}
fn hex(value: &str, size: usize) -> bool {
    value.len() == size
        && value
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}
fn digits(value: &str, max: usize) -> bool {
    !value.is_empty() && value.len() <= max && value.bytes().all(|b| b.is_ascii_digit())
}
fn pem(raw: &str, label: &str) -> Result<Vec<u8>, &'static str> {
    let inner = raw
        .trim()
        .strip_prefix(&format!("-----BEGIN {label}-----"))
        .and_then(|s| s.strip_suffix(&format!("-----END {label}-----")))
        .ok_or("QA_PROFILE_REJECTED")?;
    STANDARD
        .decode(
            inner
                .chars()
                .filter(|c| !c.is_ascii_whitespace())
                .collect::<String>(),
        )
        .map_err(|_| "QA_PROFILE_REJECTED")
}
pub fn validate(trust: &str, envelope: &str, now: u64) -> Result<Profile, &'static str> {
    let invalid = "QA_PROFILE_REJECTED";
    if trust.len() > 8192 || envelope.len() > 32768 {
        return Err(invalid);
    }
    let t: Trust = serde_json::from_str(trust).map_err(|_| invalid)?;
    let e: Envelope = serde_json::from_str(envelope).map_err(|_| invalid)?;
    if e.payload.len() > 24576 || e.signature.len() != 86 {
        return Err(invalid);
    }
    let key = pem(&t.public_key, "PUBLIC KEY")?;
    if key.len() != 44 || key[..12] != [48, 42, 48, 5, 6, 3, 43, 101, 112, 3, 33, 0] {
        return Err(invalid);
    }
    let bytes = URL_SAFE_NO_PAD.decode(e.payload).map_err(|_| invalid)?;
    let signature = URL_SAFE_NO_PAD.decode(e.signature).map_err(|_| invalid)?;
    UnparsedPublicKey::new(&ED25519, &key[12..])
        .verify(&bytes, &signature)
        .map_err(|_| invalid)?;
    let p: Profile = serde_json::from_slice(&bytes).map_err(|_| invalid)?;
    if t.contract != "NALANDA_SYNTHETIC_BUILD_V1"
        || p.contract != "NALANDA_NATIVE_QA_PROFILE_V1"
        || p.source != t.source
        || p.run_id != t.run_id
        || p.attempt != t.attempt
        || p.build_id != t.build_id
        || !hex(&p.source, 40)
        || !digits(&p.run_id, 20)
        || !digits(&p.attempt, 6)
        || [
            &p.build_id,
            &p.native_build_id,
            &p.database_sha256,
            &p.ca_sha256,
        ]
        .iter()
        .any(|v| !hex(v, 64))
        || p.origin != "https://portable-staging.localhost:8443"
        || p.environment != "synthetic-staging"
        || p.phase != "windows-auth"
        || p.app_id != "com.nalandaps.erp"
        || p.architecture != "x64"
        || p.issued_at > now
        || p.expires_at <= now
        || p.expires_at <= p.issued_at
        || p.expires_at - p.issued_at > 3600000
        || p.paths != PATHS
        || p.ca_pem.len() > 8192
    {
        return Err(invalid);
    }
    let der = pem(&p.ca_pem, "CERTIFICATE")?;
    if format!("{:x}", Sha256::digest(&der)) != p.ca_sha256 {
        return Err(invalid);
    }
    reqwest::Certificate::from_der(&der).map_err(|_| invalid)?;
    Ok(p)
}
pub fn current() -> Result<Option<Profile>, &'static str> {
    #[cfg(feature = "synthetic-qa")]
    {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|_| "QA_CLOCK_INVALID")?
            .as_millis() as u64;
        validate(
            include_str!(concat!(env!("OUT_DIR"), "/trust.json")),
            include_str!(concat!(env!("OUT_DIR"), "/profile.json")),
            now,
        )
        .map(Some)
    }
    #[cfg(not(feature = "synthetic-qa"))]
    {
        Ok(None)
    }
}
pub fn client() -> Result<reqwest::Client, &'static str> {
    client_builder(current()?.as_ref())?
        .build()
        .map_err(|_| "NETWORK_SETUP_FAILED")
}
fn client_builder(profile: Option<&Profile>) -> Result<reqwest::ClientBuilder, &'static str> {
    let mut builder = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(std::time::Duration::from_secs(20));
    if let Some(profile) = profile {
        builder = builder
            .https_only(true)
            .no_proxy()
            .tls_built_in_root_certs(false)
            .add_root_certificate(
                reqwest::Certificate::from_pem(profile.ca_pem.as_bytes())
                    .map_err(|_| "QA_CA_INVALID")?,
            );
    }
    Ok(builder)
}

#[cfg(test)]
mod tests {
    use super::*;
    use ring::{
        rand::SystemRandom,
        signature::{Ed25519KeyPair, KeyPair},
    };
    use std::{
        fs,
        net::{TcpListener, TcpStream},
        process::{Child, Command, Stdio},
        time::{Duration, Instant},
    };
    fn openssl(args: &[&str]) {
        let bin = if cfg!(windows) {
            "C:/Program Files/Git/usr/bin/openssl.exe"
        } else {
            "openssl"
        };
        let result = Command::new(bin)
            .args(args)
            .output()
            .expect("isolated TLS fixture requires OpenSSL");
        assert!(
            result.status.success(),
            "TLS fixture {} setup failed",
            args[0]
        );
    }
    fn fixture() -> (tempfile::TempDir, String) {
        let dir = tempfile::tempdir().unwrap();
        // Do not inherit platform OpenSSL configuration/extensions. The macOS
        // runner rejected the generated root with ExtensionValueInvalid before
        // any handshake; all fixture extensions must be explicit and portable.
        fs::write(dir.path().join("request.cnf"), "[req]\ndistinguished_name=dn\n[dn]\n[ca]\nbasicConstraints=critical,CA:TRUE\nkeyUsage=critical,keyCertSign,cRLSign\nsubjectKeyIdentifier=hash\n").unwrap();
        openssl(&[
            "req",
            "-config",
            dir.path().join("request.cnf").to_str().unwrap(),
            "-extensions",
            "ca",
            "-x509",
            "-newkey",
            "rsa:2048",
            "-nodes",
            "-keyout",
            dir.path().join("key.pem").to_str().unwrap(),
            "-out",
            dir.path().join("ca.pem").to_str().unwrap(),
            "-days",
            "1",
            "-subj",
            "/CN=Nalanda synthetic TLS fixture",
        ]);
        openssl(&[
            "req",
            "-config",
            dir.path().join("request.cnf").to_str().unwrap(),
            "-new",
            "-newkey",
            "rsa:2048",
            "-nodes",
            "-keyout",
            dir.path().join("leaf-key.pem").to_str().unwrap(),
            "-out",
            dir.path().join("leaf.csr").to_str().unwrap(),
            "-subj",
            "/CN=portable-staging.localhost",
        ]);
        fs::write(dir.path().join("extensions.cnf"),"basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=DNS:portable-staging.localhost\n").unwrap();
        for (name, days) in [("leaf.pem", "1")] {
            openssl(&[
                "x509",
                "-req",
                "-in",
                dir.path().join("leaf.csr").to_str().unwrap(),
                "-CA",
                dir.path().join("ca.pem").to_str().unwrap(),
                "-CAkey",
                dir.path().join("key.pem").to_str().unwrap(),
                "-set_serial",
                "1",
                "-days",
                days,
                "-extfile",
                dir.path().join("extensions.cnf").to_str().unwrap(),
                "-out",
                dir.path().join(name).to_str().unwrap(),
            ]);
        }
        // Explicit historical validity avoids a same-second, zero-day fixture
        // depending on runner speed. This is OpenSSL's private fixture catalogue,
        // not an application database or host/security clock adjustment.
        fs::write(dir.path().join("index"), "").unwrap();
        fs::write(dir.path().join("serial"), "02\n").unwrap();
        let root = dir.path().to_str().unwrap().replace('\\', "/");
        let config=format!("[ca]\ndefault_ca=fixture\n[fixture]\ndatabase={root}/index\nserial={root}/serial\nnew_certs_dir={root}\ncertificate={root}/ca.pem\nprivate_key={root}/key.pem\ndefault_md=sha256\npolicy=policy\nx509_extensions=server\n[policy]\ncommonName=supplied\n[server]\nbasicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=DNS:portable-staging.localhost\n");
        fs::write(dir.path().join("expired.cnf"), config).unwrap();
        openssl(&[
            "ca",
            "-batch",
            "-config",
            dir.path().join("expired.cnf").to_str().unwrap(),
            "-in",
            dir.path().join("leaf.csr").to_str().unwrap(),
            "-out",
            dir.path().join("expired.pem").to_str().unwrap(),
            "-startdate",
            "20200101000000Z",
            "-enddate",
            "20200102000000Z",
            "-notext",
        ]);
        let ca = fs::read_to_string(dir.path().join("ca.pem")).unwrap();
        (dir, ca)
    }
    fn signed(ca: &str) -> (String, String, serde_json::Value, Ed25519KeyPair) {
        let key = Ed25519KeyPair::generate_pkcs8(&SystemRandom::new()).unwrap();
        let pair = Ed25519KeyPair::from_pkcs8(key.as_ref()).unwrap();
        let mut der = vec![48, 42, 48, 5, 6, 3, 43, 101, 112, 3, 33, 0];
        der.extend(pair.public_key().as_ref());
        let trust=serde_json::json!({"contract":"NALANDA_SYNTHETIC_BUILD_V1","source":"a".repeat(40),"runId":"123","attempt":"1","buildId":"b".repeat(64),"publicKey":format!("-----BEGIN PUBLIC KEY-----\n{}\n-----END PUBLIC KEY-----",STANDARD.encode(der))}).to_string();
        let p = serde_json::json!({"contract":"NALANDA_NATIVE_QA_PROFILE_V1","source":"a".repeat(40),"runId":"123","attempt":"1","buildId":"b".repeat(64),"nativeBuildId":"c".repeat(64),"databaseSha256":"d".repeat(64),"origin":"https://portable-staging.localhost:8443","environment":"synthetic-staging","phase":"windows-auth","appId":"com.nalandaps.erp","architecture":"x64","issuedAt":1000,"expiresAt":61000,"caPem":ca,"caSha256":format!("{:x}",Sha256::digest(pem(ca,"CERTIFICATE").unwrap())),"paths":PATHS});
        let envelope = seal(&p, &pair);
        (trust, envelope, p, pair)
    }
    fn seal(p: &serde_json::Value, key: &Ed25519KeyPair) -> String {
        let b = p.to_string();
        serde_json::json!({"payload":URL_SAFE_NO_PAD.encode(b.as_bytes()),"signature":URL_SAFE_NO_PAD.encode(key.sign(b.as_bytes()).as_ref())}).to_string()
    }
    #[test]
    fn signed_profile_rejects_substitution_expiry_scope_and_production_injection() {
        let (_dir, ca) = fixture();
        let (t, e, p, key) = signed(&ca);
        assert!(validate(&t, &e, 1001).is_ok());
        assert!(validate(&t, &e, 61000).is_err());
        assert!(validate("null", &e, 1001).is_err());
        for (field, value) in [
            ("origin", serde_json::json!("https://foreign.invalid:8443")),
            ("source", serde_json::json!("f".repeat(40))),
            ("paths", serde_json::json!(["/api/native/v1/sync"])),
            ("caSha256", serde_json::json!("e".repeat(64))),
            ("extra", serde_json::json!(true)),
        ] {
            let mut changed = p.clone();
            changed[field] = value;
            assert!(validate(&t, &seal(&changed, &key), 1001).is_err());
        }
        let mut wrong: serde_json::Value = serde_json::from_str(&e).unwrap();
        wrong["signature"] = serde_json::json!("a".repeat(86));
        assert!(validate(&t, &wrong.to_string(), 1001).is_err());
        #[cfg(not(feature = "synthetic-qa"))]
        assert!(current().unwrap().is_none());
    }
    struct Server(Child);
    impl Drop for Server {
        fn drop(&mut self) {
            let _ = self.0.kill();
            let _ = self.0.wait();
        }
    }
    fn serve(
        dir: &tempfile::TempDir,
        certificate: &str,
        http_file: bool,
    ) -> (Server, std::net::SocketAddr) {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        drop(listener);
        let bin = if cfg!(windows) {
            "C:/Program Files/Git/usr/bin/openssl.exe"
        } else {
            "openssl"
        };
        let mut command = Command::new(bin);
        command
            .args([
                "s_server",
                "-accept",
                &address.to_string(),
                "-cert",
                dir.path().join(certificate).to_str().unwrap(),
                "-key",
                dir.path().join("leaf-key.pem").to_str().unwrap(),
                if http_file { "-HTTP" } else { "-www" },
                "-quiet",
            ])
            .current_dir(dir.path())
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null());
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            command.creation_flags(0x08000000);
        }
        let mut child = Server(command.spawn().unwrap());
        let deadline = Instant::now() + Duration::from_secs(5);
        loop {
            assert!(
                child.0.try_wait().unwrap().is_none(),
                "TLS fixture process failed"
            );
            if TcpStream::connect_timeout(&address, Duration::from_millis(100)).is_ok() {
                break;
            }
            assert!(Instant::now() < deadline, "TLS fixture readiness exhausted");
            std::thread::sleep(Duration::from_millis(20));
        }
        (child, address)
    }
    #[test]
    fn real_isolated_tls_handshake_rejects_wrong_hostname_ca_and_expired_leaf() {
        let (dir, ca) = fixture();
        let (t, e, _, _) = signed(&ca);
        let profile = validate(&t, &e, 1001).unwrap();
        let (_server, address) = serve(&dir, "leaf.pem", false);
        // Test-only socket mapping preserves the authenticated DNS name; production
        // client has no resolver override. No ERP or authenticated data is served.
        let client = client_builder(Some(&profile))
            .unwrap()
            .resolve("portable-staging.localhost", address)
            .build()
            .unwrap();
        tauri::async_runtime::block_on(async {
            assert!(client
                .get(format!(
                    "https://portable-staging.localhost:{}/",
                    address.port()
                ))
                .send()
                .await
                .unwrap()
                .status()
                .is_success());
            assert!(client
                .get(format!("https://127.0.0.1:{}/", address.port()))
                .send()
                .await
                .is_err());
        });
        let (_other_dir, other_ca) = fixture();
        let (ot, oe, _, _) = signed(&other_ca);
        let other = validate(&ot, &oe, 1001).unwrap();
        let client = client_builder(Some(&other))
            .unwrap()
            .resolve("portable-staging.localhost", address)
            .build()
            .unwrap();
        tauri::async_runtime::block_on(async {
            assert!(client
                .get(format!(
                    "https://portable-staging.localhost:{}/",
                    address.port()
                ))
                .send()
                .await
                .is_err());
        });
        let (_expired_server, expired_address) = serve(&dir, "expired.pem", false);
        let client = client_builder(Some(&profile))
            .unwrap()
            .resolve("portable-staging.localhost", expired_address)
            .build()
            .unwrap();
        tauri::async_runtime::block_on(async {
            assert!(client
                .get(format!(
                    "https://portable-staging.localhost:{}/",
                    expired_address.port()
                ))
                .send()
                .await
                .is_err());
        });
        fs::write(dir.path().join("redirect"), "HTTP/1.0 302 Found\r\nLocation: https://foreign.invalid/credentials\r\nContent-Length: 0\r\n\r\n").unwrap();
        let (_redirect_server, redirect_address) = serve(&dir, "leaf.pem", true);
        let client = client_builder(Some(&profile))
            .unwrap()
            .resolve("portable-staging.localhost", redirect_address)
            .build()
            .unwrap();
        tauri::async_runtime::block_on(async {
            let response = client
                .get(format!(
                    "https://portable-staging.localhost:{}/redirect",
                    redirect_address.port()
                ))
                .header("authorization", "synthetic-fixture-only")
                .send()
                .await
                .unwrap();
            assert_eq!(response.status(), reqwest::StatusCode::FOUND);
            assert_eq!(
                response.url().host_str(),
                Some("portable-staging.localhost")
            );
        });
    }
}
