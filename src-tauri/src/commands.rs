use std::fmt;

#[derive(serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Mode {
    Plan,
    Implement,
}

#[derive(serde::Serialize, Debug)]
#[serde(tag = "kind")]
pub enum LaunchError {
    UnsupportedPlatform { platform: String },
    InvalidTicketId { value: String },
    InvalidProjectPath { path: String },
    OsascriptSpawnFailed { message: String },
    OsascriptExitFailure { exit_code: i32, stderr: String },
}

impl fmt::Display for LaunchError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::UnsupportedPlatform { platform } => write!(f, "unsupported platform: {platform}"),
            Self::InvalidTicketId { value } => write!(f, "invalid ticket id: {value}"),
            Self::InvalidProjectPath { path } => write!(f, "invalid project path: {path}"),
            Self::OsascriptSpawnFailed { message } => {
                write!(f, "osascript spawn failed: {message}")
            }
            Self::OsascriptExitFailure { exit_code, stderr } => {
                write!(f, "osascript exited {exit_code}: {stderr}")
            }
        }
    }
}

impl std::error::Error for LaunchError {}

fn validate_ticket_id(id: &str) -> Result<(), LaunchError> {
    let err = || LaunchError::InvalidTicketId { value: id.to_owned() };
    let bytes = id.as_bytes();
    if bytes.is_empty() {
        return Err(err());
    }
    let h = bytes.iter().position(|&b| b == b'-').ok_or_else(err)?;
    if h == 0 {
        return Err(err());
    }
    let prefix = &bytes[..h];
    if !prefix[0].is_ascii_uppercase() {
        return Err(err());
    }
    for &b in &prefix[1..] {
        if !b.is_ascii_uppercase() && !b.is_ascii_digit() {
            return Err(err());
        }
    }
    let suffix = &bytes[h + 1..];
    if suffix.is_empty() {
        return Err(err());
    }
    for &b in suffix {
        if !b.is_ascii_digit() {
            return Err(err());
        }
    }
    Ok(())
}

fn validate_project_path(p: &str) -> Result<(), LaunchError> {
    let err = || LaunchError::InvalidProjectPath { path: p.to_owned() };
    if p.is_empty() || p.contains('\n') {
        return Err(err());
    }
    if !std::path::Path::new(p).is_dir() {
        return Err(err());
    }
    Ok(())
}

fn flags_for(mode: &Mode) -> (&'static str, &'static str) {
    match mode {
        Mode::Plan => ("claude-opus-4-7", "rat-plan-ticket"),
        Mode::Implement => ("claude-sonnet-4-6", "rat-implement-ticket"),
    }
}

fn build_applescript(project_path: &str, ticket_id: &str, mode: &Mode) -> String {
    let (model, skill) = flags_for(mode);
    let escaped = project_path.replace('\\', "\\\\").replace('"', "\\\"");
    // iTerm2: create window with default profile so the user's dark theme is used.
    // Terminal.app's do script always uses the Default profile which may differ from the
    // active profile and causes Claude Code's TUI to render with wrong background colors.
    // PATH prefix: ~/.local/bin is where Claude Code CLI installs but may not reach new
    // shell sessions opened via AppleScript (envman hook that adds it isn't always sourced).
    format!(
        "tell application \"iTerm\"\n  create window with default profile\n  tell current session of current window\n    write text \"export PATH=$HOME/.local/bin:$PATH; cd \" & quoted form of \"{escaped}\" & \" && claude --model {model} --permission-mode acceptEdits '/{skill} {ticket_id} --exit-after-complete'\"\n  end tell\nend tell"
    )
}

#[tauri::command]
pub fn launch_claude_skill(
    project_path: String,
    ticket_id: String,
    mode: Mode,
) -> Result<(), LaunchError> {
    if !cfg!(target_os = "macos") {
        return Err(LaunchError::UnsupportedPlatform {
            platform: std::env::consts::OS.to_string(),
        });
    }
    validate_ticket_id(&ticket_id)?;
    validate_project_path(&project_path)?;
    let script = build_applescript(&project_path, &ticket_id, &mode);
    let output = std::process::Command::new("osascript")
        .args(["-e", &script])
        .output()
        .map_err(|e| LaunchError::OsascriptSpawnFailed {
            message: e.to_string(),
        })?;
    if !output.status.success() {
        return Err(LaunchError::OsascriptExitFailure {
            exit_code: output.status.code().unwrap_or(-1),
            stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
        });
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ticket_id_valid() {
        for id in ["RAT-1", "RAT-99", "MUN-5", "ABC-123"] {
            assert!(validate_ticket_id(id).is_ok(), "expected Ok for {id}");
        }
    }

    #[test]
    fn ticket_id_invalid() {
        for id in [
            "",
            "rat-1",
            "RAT_1",
            "RAT-1; rm -rf /",
            "RAT-1\n",
            "RAT-",
            "-5",
            "1",
            "RAT-0a",
        ] {
            assert!(validate_ticket_id(id).is_err(), "expected Err for {id:?}");
        }
    }

    #[test]
    fn project_path_valid() {
        let tmp = std::env::temp_dir();
        assert!(validate_project_path(tmp.to_str().unwrap()).is_ok());
    }

    #[test]
    fn project_path_invalid() {
        for p in ["", "/this/does/not/exist/xyz9999", "/path/with\nnewline"] {
            assert!(validate_project_path(p).is_err(), "expected Err for {p:?}");
        }
        let tmp = std::env::temp_dir();
        let file = tmp.join("rat79_test_file_probe.txt");
        std::fs::write(&file, b"").unwrap();
        assert!(validate_project_path(file.to_str().unwrap()).is_err());
        let _ = std::fs::remove_file(&file);
    }

    #[test]
    fn applescript_plan() {
        let script = build_applescript("/tmp/foo", "RAT-1", &Mode::Plan);
        assert!(script.contains("tell application \"iTerm\""));
        assert!(script.contains("create window with default profile"));
        assert!(script.contains("PATH=$HOME/.local/bin:$PATH"));
        assert!(script.contains("claude --model claude-opus-4-7"));
        assert!(script.contains("--permission-mode acceptEdits"));
        assert!(script.contains("'/rat-plan-ticket RAT-1 --exit-after-complete'"));
        assert!(script.contains("cd \" & quoted form of \"/tmp/foo\""));
    }

    #[test]
    fn applescript_implement() {
        let script = build_applescript("/tmp/foo", "RAT-1", &Mode::Implement);
        assert!(script.contains("claude --model claude-sonnet-4-6"));
        assert!(script.contains("'/rat-implement-ticket RAT-1 --exit-after-complete'"));
    }

    #[test]
    fn applescript_escapes_double_quote_in_path() {
        let script = build_applescript("/tmp/foo\"bar", "RAT-1", &Mode::Plan);
        assert!(script.contains("\\\""), "double-quote in path must be escaped");
    }
}
