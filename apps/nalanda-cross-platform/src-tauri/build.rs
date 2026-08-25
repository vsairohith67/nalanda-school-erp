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
    tauri_build::try_build(
        tauri_build::Attributes::new()
            .app_manifest(tauri_build::AppManifest::new().commands(COMMANDS)),
    )
    .expect("failed to build Tauri application manifest");
}
