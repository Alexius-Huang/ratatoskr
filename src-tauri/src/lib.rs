use std::net::TcpStream;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
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

// Polls the given TCP port until it accepts connections or the timeout elapses.
fn wait_for_port_ready(host: &str, port: u16, timeout: Duration) -> bool {
  let deadline = Instant::now() + timeout;
  let addr = format!("{host}:{port}");
  while Instant::now() < deadline {
    if TcpStream::connect_timeout(&addr.parse().expect("invalid addr"), Duration::from_millis(200))
      .is_ok()
    {
      return true;
    }
    std::thread::sleep(Duration::from_millis(50));
  }
  false
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
    .plugin(tauri_plugin_opener::init())
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

      // Tracks whether the window has been shown so the sidecar path and the 15s fallback
      // don't both fire.
      let shown = Arc::new(Mutex::new(false));
      let shown_timeout = shown.clone();

      // Hard timeout fallback: show the window after 15s regardless, so a sidecar crash or
      // other error never leaves the user staring at a permanently hidden window.
      let timeout_handle = app.handle().clone();
      std::thread::spawn(move || {
        std::thread::sleep(Duration::from_secs(15));
        if let Ok(mut guard) = shown_timeout.lock() {
          if !*guard {
            *guard = true;
            if let Some(win) = timeout_handle.get_webview_window("main") {
              let _ = win.show();
              eprintln!("[boot] window shown (15s fallback)");
            }
          }
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
              eprintln!("[server] {}", text);
              if text.contains("listening") {
                // The WebView's initial navigation to http://localhost:17653 was launched at
                // window-create time, before the sidecar was ready, and failed with
                // ERR_CONNECTION_REFUSED. Now that the sidecar is up, reload the page.
                //
                // Belt-and-suspenders: probe the TCP port first to confirm the OS has actually
                // bound the socket (there's a microscopic gap between Bun.serve() returning
                // and the kernel accepting connections).
                if wait_for_port_ready("127.0.0.1", 17653, Duration::from_secs(3)) {
                  if let Some(win) = handle.get_webview_window("main") {
                    let _ = win.reload();
                    eprintln!("[boot] sidecar ready, webview reload triggered");
                  }
                  // Wait for the WebView to complete its reload before revealing the window.
                  // The server is local; HTML parse + React hydration of the pre-built bundle
                  // completes well within 1s even on first run.
                  std::thread::sleep(Duration::from_millis(1000));
                } else {
                  eprintln!("[boot] TCP probe timed out after 3s");
                }
                if let Ok(mut guard) = shown.lock() {
                  if !*guard {
                    *guard = true;
                    if let Some(win) = handle.get_webview_window("main") {
                      let _ = win.show();
                      eprintln!("[boot] window shown");
                    }
                  }
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
