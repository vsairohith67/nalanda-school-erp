const COMMANDS: &[&str] = &[
    "app_profile",
    "cache_put",
    "cache_list",
    "cache_delete",
    "native_api_request",
    "open_authorization",
    "open_online_erp",
];

fn main() {
    for name in [
        "NALANDA_QA_INPUT_DIRECTORY",
        "NALANDA_NATIVE_PROFILE",
        "NALANDA_QA_PROFILE_SHA256",
        "NALANDA_QA_TRUST_SHA256",
    ] {
        println!("cargo:rerun-if-env-changed={name}");
    }
    if std::env::var_os("CARGO_FEATURE_SYNTHETIC_QA").is_some() {
        assert_eq!(std::env::var("CARGO_CFG_TARGET_OS").unwrap(), "windows");
        assert_eq!(std::env::var("CARGO_CFG_TARGET_ARCH").unwrap(), "x86_64");
        let root = std::path::PathBuf::from(
            std::env::var_os("NALANDA_QA_INPUT_DIRECTORY").expect("QA public inputs required"),
        );
        assert!(root.is_absolute(), "QA directory must be absolute");
        for ancestor in root.ancestors() {
            let metadata = std::fs::symlink_metadata(ancestor).expect("QA ancestor");
            assert!(!metadata.file_type().is_symlink(), "QA symlink refused");
            #[cfg(windows)]
            {
                use std::os::windows::fs::MetadataExt;
                assert_eq!(
                    metadata.file_attributes() & 0x400,
                    0,
                    "QA reparse point refused"
                );
            }
        }
        let root = std::fs::canonicalize(root).expect("QA directory");
        let output = std::path::PathBuf::from(std::env::var_os("OUT_DIR").unwrap());
        for name in ["profile.json", "trust.json"] {
            let file = root.join(name);
            let meta = std::fs::symlink_metadata(&file).expect("QA public file");
            assert!(meta.is_file() && !meta.file_type().is_symlink() && meta.len() <= 32768);
            println!("cargo:rerun-if-changed={}", file.display());
            use sha2::{Digest, Sha256};
            let bytes = std::fs::read(&file).expect("QA public input read");
            let expected = std::env::var(if name == "profile.json" {
                "NALANDA_QA_PROFILE_SHA256"
            } else {
                "NALANDA_QA_TRUST_SHA256"
            })
            .expect("Validated QA input digest required");
            assert_eq!(
                format!("{:x}", Sha256::digest(&bytes)),
                expected,
                "QA input substituted after validation"
            );
            std::fs::write(output.join(name), &bytes).expect("QA public input copy");
            assert_eq!(
                std::fs::read(output.join(name)).unwrap(),
                bytes,
                "QA consumed input changed"
            );
        }
    } else {
        assert!(
            std::env::var_os("NALANDA_QA_INPUT_DIRECTORY").is_none(),
            "Production rejects QA inputs"
        );
        assert!(
            std::env::var_os("NALANDA_QA_PROFILE_SHA256").is_none()
                && std::env::var_os("NALANDA_QA_TRUST_SHA256").is_none(),
            "Production rejects QA digest inputs"
        );
        assert_ne!(
            std::env::var("NALANDA_NATIVE_PROFILE").unwrap_or_default(),
            "SYNTHETIC_QA",
            "Production rejects QA profile"
        );
    }
    tauri_build::try_build(
        tauri_build::Attributes::new()
            .app_manifest(tauri_build::AppManifest::new().commands(COMMANDS)),
    )
    .expect("failed to build Tauri application manifest");
}
