import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as https from 'https';
import * as http from 'http';
import { playSound } from './audioPlayer';
import { getBuiltInSoundFile, getBuiltInSoundNames } from './generateSounds';

export class SfxManager implements vscode.Disposable {
  private downloadDir: string;
  private builtInDir: string;
  private outputChannel: vscode.OutputChannel;
  private lastPlayTime = 0;
  private readonly DEBOUNCE_MS = 300;
  private disposables: vscode.Disposable[] = [];

  constructor(private context: vscode.ExtensionContext) {
    this.builtInDir = path.join(context.extensionUri.fsPath, 'media', 'sounds');
    this.downloadDir = path.join(context.globalStorageUri.fsPath, 'sounds');
    this.outputChannel = vscode.window.createOutputChannel('Terminal Sound Effects');
    this.disposables.push(this.outputChannel);
  }

  private readonly DEFAULT_SOUND = 'faah';

  async initialize(): Promise<void> {
    await fs.promises.mkdir(this.downloadDir, { recursive: true });
    await this.resetIfInvalid();
  }

  private async resetIfInvalid(): Promise<void> {
    const selected = this.getSelectedSoundName();
    if (!selected) return;
    if (path.isAbsolute(selected) && fs.existsSync(selected)) return;
    if (!path.isAbsolute(selected) && this.isBuiltIn(selected)) return;
    await this.selectSound(this.DEFAULT_SOUND);
  }

  getBuiltInDir(): string {
    return this.builtInDir;
  }

  getConfig(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration('terminalSfx');
  }

  isEnabled(): boolean {
    return this.getConfig().get<boolean>('enabled', true);
  }

  async toggle(): Promise<void> {
    const current = this.isEnabled();
    await this.getConfig().update('enabled', !current, vscode.ConfigurationTarget.Global);
    vscode.window.showInformationMessage(`Terminal Sound Effects ${!current ? 'enabled' : 'disabled'}.`);
  }

  resolveSelectedSound(): string | undefined {
    const selected = this.getConfig().get<string>('selectedSound', '');
    if (!selected) return undefined;

    if (path.isAbsolute(selected)) {
      if (fs.existsSync(selected)) return selected;
      this.outputChannel.appendLine(`Custom sound file not found: ${selected}`);
      return undefined;
    }

    const file = getBuiltInSoundFile(this.builtInDir, selected);
    if (file) {
      const fullPath = path.join(this.builtInDir, file);
      if (fs.existsSync(fullPath)) return fullPath;
      this.outputChannel.appendLine(`Built-in sound file missing: ${fullPath}`);
    }

    return undefined;
  }

  handleError(): void {
    if (!this.isEnabled()) return;

    const now = Date.now();
    if (now - this.lastPlayTime < this.DEBOUNCE_MS) return;
    this.lastPlayTime = now;

    const filePath = this.resolveSelectedSound();
    if (!filePath) return;

    const volume = this.getConfig().get<number>('volume', 80);
    playSound({ filePath, volume });
  }

  async selectFileFromSystem(): Promise<void> {
    const uris = await vscode.window.showOpenDialog({
      canSelectMany: false,
      filters: { 'Audio Files': ['mp3', 'wav', 'ogg'] },
      title: 'Select a sound effect file',
    });

    if (uris && uris.length > 0) {
      const filePath = uris[0].fsPath;
      const stat = await fs.promises.stat(filePath);
      if (stat.size > this.MAX_FILE_BYTES) {
        vscode.window.showErrorMessage('File too large (max 5MB).');
        return;
      }
      await this.selectSound(filePath);
      vscode.window.showInformationMessage(`Sound set to: ${path.basename(filePath)}`);
    }
  }

  private readonly MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB

  async downloadFromUrl(url: string): Promise<string> {
    const ext = path.extname(new URL(url).pathname) || '.mp3';
    const filename = `custom-${Date.now()}${ext}`;
    const destPath = path.join(this.downloadDir, filename);

    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;
      const file = fs.createWriteStream(destPath);

      client.get(url, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          file.close();
          fs.unlink(destPath, () => {});
          const location = response.headers.location;
          if (location) {
            this.downloadFromUrl(location).then(resolve).catch(reject);
          } else {
            reject(new Error('Redirect with no location header'));
          }
          return;
        }

        if (response.statusCode !== 200) {
          file.close();
          fs.unlink(destPath, () => {});
          reject(new Error(`Download failed with status ${response.statusCode}`));
          return;
        }

        let received = 0;
        response.on('data', (chunk: Buffer) => {
          received += chunk.length;
          if (received > this.MAX_FILE_BYTES) {
            response.destroy();
            file.close();
            fs.unlink(destPath, () => {});
            reject(new Error('File too large (max 5MB)'));
          }
        });

        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve(destPath);
        });
      }).on('error', (err) => {
        file.close();
        fs.unlink(destPath, () => {});
        reject(err);
      });
    });
  }

  async selectSound(nameOrPath: string): Promise<void> {
    await this.getConfig().update('selectedSound', nameOrPath, vscode.ConfigurationTarget.Global);
  }

  getSelectedSoundName(): string {
    return this.getConfig().get<string>('selectedSound', '');
  }

  isBuiltIn(name: string): boolean {
    return getBuiltInSoundNames(this.builtInDir).includes(name);
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
  }
}
