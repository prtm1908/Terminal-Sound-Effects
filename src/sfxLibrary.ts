import * as vscode from 'vscode';
import * as path from 'path';
import { SfxManager } from './sfxManager';
import { getBuiltInSounds, getBuiltInSoundLabel, getBuiltInSoundFile } from './generateSounds';
import { playSound } from './audioPlayer';

export class SfxLibraryPanel {
  public static currentPanel: SfxLibraryPanel | undefined;
  private static readonly viewType = 'terminalSfxLibrary';

  private readonly panel: vscode.WebviewPanel;
  private readonly sfxManager: SfxManager;
  private disposables: vscode.Disposable[] = [];

  public static refreshIfOpen(): void {
    if (SfxLibraryPanel.currentPanel) {
      SfxLibraryPanel.currentPanel.updateContent();
    }
  }

  public static createOrShow(sfxManager: SfxManager): void {
    const column = vscode.window.activeTextEditor?.viewColumn;

    if (SfxLibraryPanel.currentPanel) {
      SfxLibraryPanel.currentPanel.panel.reveal(column);
      SfxLibraryPanel.currentPanel.updateContent();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      SfxLibraryPanel.viewType,
      'Terminal Sound Effects Library',
      column || vscode.ViewColumn.One,
      { enableScripts: true }
    );

    SfxLibraryPanel.currentPanel = new SfxLibraryPanel(panel, sfxManager);
  }

  private constructor(panel: vscode.WebviewPanel, sfxManager: SfxManager) {
    this.panel = panel;
    this.sfxManager = sfxManager;

    this.updateContent();

    this.panel.webview.onDidReceiveMessage(
      async (message) => {
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
            this.updateContent();
            vscode.window.showInformationMessage(`Sound set to: ${getBuiltInSoundLabel(this.sfxManager.getBuiltInDir(), message.soundName)}`);
            break;
          case 'selectFile':
            await this.sfxManager.selectFileFromSystem();
            this.updateContent();
            break;
          case 'downloadUrl':
            try {
              const filePath = await this.sfxManager.downloadFromUrl(message.url);
              await this.sfxManager.selectSound(filePath);
              this.updateContent();
              vscode.window.showInformationMessage('Sound downloaded and selected!');
            } catch (err: any) {
              vscode.window.showErrorMessage(`Download failed: ${err.message}`);
            }
            break;
          case 'toggle':
            await this.sfxManager.toggle();
            this.updateContent();
            break;
        }
      },
      null,
      this.disposables
    );

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }

  private resolveSoundPath(name: string): string | undefined {
    if (path.isAbsolute(name)) return name;
    const file = getBuiltInSoundFile(this.sfxManager.getBuiltInDir(), name);
    if (file) return path.join(this.sfxManager.getBuiltInDir(), file);
    return undefined;
  }

  private updateContent(): void {
    this.panel.webview.html = this.getHtmlContent();
  }

  private getHtmlContent(): string {
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
          <div class="sound-icon">${escapeHtml(emoji)}</div>
          <div class="sound-name">${escapeHtml(label)}</div>
          <div class="sound-actions">
            <button class="btn secondary preview-btn" data-sound="${escapeHtml(name)}">
              <span class="codicon">&#9654;</span> Preview
            </button>
            <button class="btn primary select-btn" data-sound="${escapeHtml(name)}"
              ${isSelected ? 'disabled' : ''}>
              ${isSelected ? '&#10003; Selected' : 'Select'}
            </button>
          </div>
        </div>`;
      })
      .join('\n');

    const builtInSection = builtIn.length > 0
      ? `<h2>Built-in Sounds</h2>
         <div class="sound-grid">${soundCards}</div>`
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
      background: var(--vscode-editor-background);
      padding: 24px;
      line-height: 1.5;
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
      flex-wrap: wrap;
      gap: 12px;
    }

    h1 { font-size: 1.5em; font-weight: 600; }

    .current-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      border-radius: 20px;
      font-size: 0.85em;
      font-weight: 500;
    }

    h2 {
      font-size: 1.1em;
      font-weight: 600;
      margin-bottom: 14px;
      color: var(--vscode-foreground);
    }

    .subtitle {
      font-size: 0.9em;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 16px;
    }

    .empty-msg {
      font-size: 0.9em;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 20px;
      font-style: italic;
    }

    .sound-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 14px;
      margin-bottom: 28px;
    }

    .sound-card {
      border: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.35));
      border-radius: 8px;
      padding: 16px;
      background: var(--vscode-editor-background);
      transition: border-color 0.15s, box-shadow 0.15s;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .sound-card:hover { border-color: var(--vscode-focusBorder); }

    .sound-card.selected {
      border-color: var(--vscode-focusBorder);
      box-shadow: 0 0 0 1px var(--vscode-focusBorder);
      background: color-mix(in srgb, var(--vscode-focusBorder) 8%, var(--vscode-editor-background));
    }

    .sound-icon { font-size: 1.6em; line-height: 1; }
    .sound-name { font-weight: 600; font-size: 0.95em; }

    .sound-actions {
      display: flex;
      gap: 8px;
      margin-top: auto;
    }

    .btn {
      border: none;
      padding: 5px 14px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      font-family: inherit;
      display: inline-flex;
      align-items: center;
      gap: 4px;
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

    .btn:disabled { opacity: 0.55; cursor: default; }

    .custom-section {
      border: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.35));
      border-radius: 8px;
      padding: 20px;
    }

    .custom-section p {
      margin: 8px 0;
      font-size: 0.9em;
      color: var(--vscode-descriptionForeground);
    }

    .url-row { display: flex; gap: 8px; margin-top: 8px; }

    .url-row input {
      flex: 1;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, rgba(128,128,128,0.35));
      padding: 6px 10px;
      border-radius: 4px;
      font-family: inherit;
      font-size: 13px;
      outline: none;
    }

    .url-row input:focus { border-color: var(--vscode-focusBorder); }

    .divider {
      border: none;
      border-top: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.2));
      margin: 14px 0;
    }

    .toggle-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 20px;
      padding: 10px 16px;
      border: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.35));
      border-radius: 8px;
    }

    .toggle-label { font-size: 0.95em; font-weight: 500; }

    .toggle-btn {
      border: none;
      padding: 5px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      font-family: inherit;
      font-weight: 500;
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
  <div class="header">
    <h1>Terminal Sound Effects Library</h1>
    <div class="current-badge">&#9835; Now playing: ${escapeHtml(currentLabel)}</div>
  </div>

  <p class="subtitle">Choose a sound to play when a terminal command fails.</p>

  <div class="toggle-row">
    <span class="toggle-label">${enabled ? '&#128266; SFX Enabled' : '&#128263; SFX Disabled'}</span>
    <button class="toggle-btn ${enabled ? 'on' : 'off'}" id="toggle-btn">${enabled ? 'On' : 'Off'}</button>
  </div>

  <hr class="divider">

  <div class="${enabled ? '' : 'disabled-overlay'}">
  ${builtInSection}

  <div class="custom-section">
    <h2>Custom Sound</h2>
    <p>Choose a WAV or MP3 file from your computer:</p>
    <button class="btn primary" id="browse-btn">Browse Files...</button>

    <hr class="divider">

    <p>Or paste a direct downloadable link to an audio file:</p>
    <div class="url-row">
      <input type="text" id="url-input" placeholder="https://example.com/sound.mp3" />
      <button class="btn primary" id="url-btn">Download &amp; Set</button>
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
      if (url) {
        vscode.postMessage({ command: 'downloadUrl', url });
      }
    });

    document.getElementById('url-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        document.getElementById('url-btn').click();
      }
    });
  </script>
</body>
</html>`;
  }

  private dispose(): void {
    SfxLibraryPanel.currentPanel = undefined;
    this.panel.dispose();
    this.disposables.forEach((d) => d.dispose());
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
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
