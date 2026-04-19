use std::sync::{Arc, Mutex};
use tauri::Manager;
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons};
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;
use tauri_plugin_updater::UpdaterExt;

fn kill_child(slot: &Arc<Mutex<Option<tauri_plugin_shell::process::CommandChild>>>) {
  if let Ok(mut guard) = slot.lock() {
    if let Some(child) = guard.take() {
      let _ = child.kill();
    }
  }
}

async fn check_for_update(app: tauri::AppHandle) -> tauri_plugin_updater::Result<()> {
  let updater = app.updater()?;
  if let Some(update) = updater.check().await? {
    let current = app.package_info().version.to_string();
    let next = update.version.clone();

    let should_install = app
      .dialog()
      .message(format!(
        "Ratatoskr {next} is available.\nYou're on {current}. Install now?"
      ))
      .title("Update available")
      .buttons(MessageDialogButtons::OkCancelCustom(
        "Install".into(),
        "Skip".into(),
      ))
      .blocking_show();

    if should_install {
      update.download_and_install(|_chunk, _total| {}, || {}).await?;
      app.restart();
    }
  }
  Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let child_slot: Arc<Mutex<Option<tauri_plugin_shell::process::CommandChild>>> =
    Arc::new(Mutex::new(None));
  let child_slot_setup = child_slot.clone();

  let app = tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_dialog::init())
    .setup(move |app| {
      // In dev mode, the window points at the Vite dev server (devUrl) — no sidecar or update check needed.
      if cfg!(debug_assertions) {
        return Ok(());
      }

      // Spawn update check in the background so a slow/offline network doesn't stall startup.
      let update_handle = app.handle().clone();
      tauri::async_runtime::spawn(async move {
        if let Err(e) = check_for_update(update_handle).await {
          eprintln!("[updater] check failed: {e}");
        }
      });

      // Prod: get the resource dir so the sidecar can find the bundled dist/ folder.
      let resource_dir = app
        .path()
        .resource_dir()
        .expect("failed to resolve resource dir");
      let dist_dir = resource_dir.join("dist");

      let sidecar = app
        .shell()
        .sidecar("ratatoskr-server")
        .expect("failed to find sidecar binary")
        .env("RATATOSKR_PORT", "17653")
        .env("RATATOSKR_DIST_DIR", dist_dir.to_string_lossy().to_string())
        .env("RATATOSKR_PARENT_PID", std::process::id().to_string());

      let (mut rx, child) = sidecar.spawn().expect("failed to spawn sidecar");
      *child_slot_setup.lock().unwrap() = Some(child);

      let handle = app.handle().clone();
      tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
          match event {
            CommandEvent::Stdout(line) => {
              let text = String::from_utf8_lossy(&line);
              println!("[server] {}", text);
              if text.contains("listening") {
                if let Some(win) = handle.get_webview_window("main") {
                  let _ = win.show();
                }
              }
            }
            CommandEvent::Stderr(line) => {
              eprintln!("[server] {}", String::from_utf8_lossy(&line));
            }
            _ => {}
          }
        }
      });

      Ok(())
    })
    .build(tauri::generate_context!())
    .expect("error while building tauri application");

  // RunEvent::ExitRequested fires on all quit paths (⌘Q, red X, programmatic exit) —
  // unlike WindowEvent::CloseRequested which macOS bypasses for ⌘Q.
  app.run(move |_app_handle, event| {
    if let tauri::RunEvent::ExitRequested { .. } = event {
      kill_child(&child_slot);
    }
  });
}
