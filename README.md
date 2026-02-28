# Terminal Sound Effects

A VS Code extension that plays a sound effect when a terminal command fails.

## Features

- **Automatic error detection** — listens for non-zero exit codes in the integrated terminal and plays a sound
- **Built-in sound library** — ships with 5 sounds: FAAH, Plankton AUGH, Dun Dun Dun, Mario Death, and Roblox Uh
- **Custom sounds** — browse local files or paste a direct download link to any MP3/WAV/OGG file
- **Sidebar UI** — browse, preview, and select sounds from the activity bar
- **Full-panel library** — open via command palette (`Terminal Sound Effects: Open Sound Library`)
- **Toggle on/off** — from the sidebar, status bar, or command palette
- **Volume control** — adjustable 0–100 via `terminalSfx.volume` setting
- **Cross-platform** — macOS (`afplay`), Linux (`paplay`/`aplay`/`mpv`), Windows (PowerShell/wmplayer)
- **Safety limits** — playback auto-cuts at 20 seconds, file uploads/downloads capped at 5MB

## Setup

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Package into VSIX
npx @vscode/vsce package

# Install the VSIX
code --install-extension terminal-sfx-1.0.0.vsix
```

For development, press `F5` in VS Code to launch the Extension Development Host.

## Architecture

```
src/
  extension.ts          — Entry point. Registers commands, sidebar, status bar, and wires everything together.
  terminalMonitor.ts    — Listens for onDidEndTerminalShellExecution events and fires a callback on non-zero exit codes.
  sfxManager.ts         — Core logic: resolves the selected sound, handles file selection, URL downloads,
                          config reads/writes, and validates selections on startup.
  audioPlayer.ts        — Platform-specific audio playback using child processes. Kills playback after 20s.
  generateSounds.ts     — Auto-discovers MP3/WAV/OGG files in media/sounds/ and reads optional config.json
                          for custom labels and emojis. Caches results for performance.
  sfxLibrary.ts         — Full webview panel UI (command palette → "Open Sound Library").
  sfxSidebarProvider.ts — Activity bar sidebar webview with the same functionality in a compact layout.

media/
  sounds/               — Built-in audio files. Drop any MP3/WAV/OGG here and it's auto-discovered.
    config.json         — Optional metadata (emoji, label) for each sound, keyed by filename without extension.
```

## Configuration

| Setting                     | Default  | Description                                      |
|-----------------------------|----------|--------------------------------------------------|
| `terminalSfx.enabled`      | `true`   | Enable or disable sound effects                  |
| `terminalSfx.selectedSound`| `"faah"` | Built-in sound name or absolute path to a file   |
| `terminalSfx.volume`       | `80`     | Playback volume (0–100)                          |

## Adding Built-in Sounds

1. Drop an MP3/WAV/OGG file into `media/sounds/`
2. Optionally add an entry to `media/sounds/config.json`:
   ```json
   {
     "my-sound": {
       "emoji": "🔊",
       "label": "My Sound"
     }
   }
   ```
3. Recompile and repackage. The sound is auto-discovered — no code changes needed.
