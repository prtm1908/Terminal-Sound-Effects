import * as vscode from 'vscode';
import * as path from 'path';
import { SfxManager } from './sfxManager';
import { getBuiltInSounds, getBuiltInSoundLabel, getBuiltInSoundFile } from './generateSounds';
import { playSound } from './audioPlayer';

export class SfxSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'terminal-sfx.sidebar';
  private view?: vscode.WebviewView;

  constructor(private readonly sfxManager: SfxManager) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView;

    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this.getHtmlContent(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'preview': {
          const soundPath = this.resolveSoundPath(message.soundName);
          if (soundPath) {
            const volume = this.sfxManager.getConfig().get<number>('volume', 80);
            playSound({ filePath: soundPath, volume });
          }
          break;
        }
        case 'select':
          await this.sfxManager.selectSound(message.soundName);
          this.refresh();
          vscode.window.showInformationMessage(`Sound set to: ${getBuiltInSoundLabel(this.sfxManager.getBuiltInDir(), message.soundName)}`);
          break;
        case 'selectFile':
          await this.sfxManager.selectFileFromSystem();
          this.refresh();
          break;
        case 'downloadUrl':
          try {
            const filePath = await this.sfxManager.downloadFromUrl(message.url);
            await this.sfxManager.selectSound(filePath);
            this.refresh();
            vscode.window.showInformationMessage('Sound downloaded and selected!');
          } catch (err: any) {
            vscode.window.showErrorMessage(`Download failed: ${err.message}`);
          }
          break;
        case 'toggle':
          await this.sfxManager.toggle();
          this.refresh();
          break;
      }
    });
  }

  public refresh(): void {
    if (this.view) {
      this.view.webview.html = this.getHtmlContent(this.view.webview);
    }
  }

  private resolveSoundPath(name: string): string | undefined {
    if (path.isAbsolute(name)) return name;
    const file = getBuiltInSoundFile(this.sfxManager.getBuiltInDir(), name);
    if (file) return path.join(this.sfxManager.getBuiltInDir(), file);
    return undefined;
  }

  private getHtmlContent(_webview: vscode.Webview): string {
    const dir = this.sfxManager.getBuiltInDir();
    const selectedSound = this.sfxManager.getSelectedSoundName();
    const builtIn = getBuiltInSounds(dir);
    const nonce = getNonce();
    const enabled = this.sfxManager.isEnabled();

    const isCustom = selectedSound && !this.sfxManager.isBuiltIn(selectedSound);
    const currentLabel = !selectedSound
      ? 'None'
      : isCustom
        ? path.basename(selectedSound)
        : getBuiltInSoundLabel(dir, selectedSound);

    const soundCards = builtIn
      .map(({ name, label, emoji }) => {
        const isSelected = name === selectedSound;
        return `
        <div class="sound-card ${isSelected ? 'selected' : ''}">
          <div class="sound-header">
            <span class="sound-icon">${escapeHtml(emoji)}</span>
            <span class="sound-name">${escapeHtml(label)}</span>
          </div>
          <div class="sound-actions">
            <button class="btn secondary preview-btn" data-sound="${escapeHtml(name)}">&#9654;</button>
            <button class="btn primary select-btn" data-sound="${escapeHtml(name)}"
              ${isSelected ? 'disabled' : ''}>
              ${isSelected ? '&#10003;' : 'Use'}
            </button>
          </div>
        </div>`;
      })
      .join('\n');

    const builtInSection = builtIn.length > 0
      ? `<div class="section-label">Built-in Sounds</div>
         <div class="sound-list">${soundCards}</div>`
      : `<p class="empty-msg">No built-in sounds found. Add MP3 files to media/sounds/.</p>`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style nonce="${nonce}">
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background, var(--vscode-editor-background));
      padding: 12px;
      line-height: 1.4;
    }

    .current-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 10px;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      border-radius: 6px;
      font-size: 0.8em;
      font-weight: 500;
      margin-bottom: 14px;
    }

    .section-label {
      font-size: 0.75em;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 8px;
    }

    .subtitle {
      font-size: 0.8em;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 8px;
    }

    .empty-msg {
      font-size: 0.8em;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 14px;
      font-style: italic;
    }

    .sound-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 16px;
    }

    .sound-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.25));
      border-radius: 6px;
      padding: 8px 10px;
      background: var(--vscode-editor-background);
      transition: border-color 0.15s;
    }

    .sound-card:hover {
      border-color: var(--vscode-focusBorder);
    }

    .sound-card.selected {
      border-color: var(--vscode-focusBorder);
      background: color-mix(in srgb, var(--vscode-focusBorder) 10%, var(--vscode-editor-background));
    }

    .sound-header {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }

    .sound-icon { font-size: 1.1em; flex-shrink: 0; }

    .sound-name {
      font-size: 0.85em;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .sound-actions {
      display: flex;
      gap: 4px;
      flex-shrink: 0;
    }

    .btn {
      border: none;
      padding: 3px 10px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 11px;
      font-family: inherit;
      transition: opacity 0.15s;
    }

    .btn.primary {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    .btn.primary:hover { background: var(--vscode-button-hoverBackground); }

    .btn.secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    .btn.secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }

    .btn:disabled {
      opacity: 0.55;
      cursor: default;
    }

    .custom-section {
      border-top: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.2));
      padding-top: 12px;
    }

    .custom-section p {
      font-size: 0.8em;
      color: var(--vscode-descriptionForeground);
      margin: 6px 0;
    }

    .url-row {
      display: flex;
      gap: 6px;
      margin-top: 6px;
    }

    .url-row input {
      flex: 1;
      min-width: 0;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, rgba(128,128,128,0.35));
      padding: 4px 8px;
      border-radius: 3px;
      font-family: inherit;
      font-size: 12px;
      outline: none;
    }

    .url-row input:focus {
      border-color: var(--vscode-focusBorder);
    }

    .browse-btn {
      width: 100%;
      margin-top: 4px;
    }

    .divider {
      border: none;
      border-top: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.2));
      margin: 12px 0;
    }

    .toggle-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 14px;
      padding: 8px 10px;
      border: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.25));
      border-radius: 6px;
    }

    .toggle-label {
      font-size: 0.85em;
      font-weight: 500;
    }

    .toggle-btn {
      border: none;
      padding: 3px 12px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 11px;
      font-family: inherit;
    }

    .toggle-btn.on {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }

    .toggle-btn.off {
      background: var(--vscode-errorForeground, #f44);
      color: #fff;
    }

    .disabled-overlay {
      opacity: 0.4;
      pointer-events: none;
    }
  </style>
</head>
<body>
  <div class="toggle-row">
    <span class="toggle-label">${enabled ? '&#128266; Enabled' : '&#128263; Disabled'}</span>
    <button class="toggle-btn ${enabled ? 'on' : 'off'}" id="toggle-btn">${enabled ? 'On' : 'Off'}</button>
  </div>

  <p class="subtitle">Plays a sound when a terminal command fails.</p>

  <hr class="divider">

  <div class="${enabled ? '' : 'disabled-overlay'}">
  <div class="current-badge">&#9835; ${escapeHtml(currentLabel)}</div>

  ${builtInSection}

  <div class="custom-section">
    <div class="section-label">Custom Sound</div>
    <button class="btn primary browse-btn" id="browse-btn">Browse Files...</button>
    <p>Or paste a direct downloadable link to an audio file:</p>
    <div class="url-row">
      <input type="text" id="url-input" placeholder="https://example.com/sound.mp3" />
      <button class="btn primary" id="url-btn">Go</button>
    </div>
  </div>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    document.getElementById('toggle-btn').addEventListener('click', () => {
      vscode.postMessage({ command: 'toggle' });
    });

    document.querySelectorAll('.preview-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        vscode.postMessage({ command: 'preview', soundName: btn.dataset.sound });
      });
    });

    document.querySelectorAll('.select-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        vscode.postMessage({ command: 'select', soundName: btn.dataset.sound });
      });
    });

    document.getElementById('browse-btn').addEventListener('click', () => {
      vscode.postMessage({ command: 'selectFile' });
    });

    document.getElementById('url-btn').addEventListener('click', () => {
      const url = document.getElementById('url-input').value.trim();
      if (url) vscode.postMessage({ command: 'downloadUrl', url });
    });

    document.getElementById('url-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('url-btn').click();
    });
  </script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
