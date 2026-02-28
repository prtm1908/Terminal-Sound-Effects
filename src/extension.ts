import * as vscode from 'vscode';
import { TerminalMonitor } from './terminalMonitor';
import { SfxManager } from './sfxManager';
import { SfxLibraryPanel } from './sfxLibrary';
import { SfxSidebarProvider } from './sfxSidebarProvider';

export async function activate(context: vscode.ExtensionContext) {
  const sfxManager = new SfxManager(context);
  await sfxManager.initialize();

  const monitor = new TerminalMonitor(() => sfxManager.handleError());

  const openLibraryCmd = vscode.commands.registerCommand('terminal-sfx.openLibrary', () => {
    SfxLibraryPanel.createOrShow(sfxManager);
  });

  const selectFileCmd = vscode.commands.registerCommand('terminal-sfx.selectFile', () => {
    sfxManager.selectFileFromSystem();
  });

  const toggleCmd = vscode.commands.registerCommand('terminal-sfx.toggle', () => {
    sfxManager.toggle();
  });

  // Sidebar webview
  const sidebarProvider = new SfxSidebarProvider(sfxManager);
  const sidebarRegistration = vscode.window.registerWebviewViewProvider(
    SfxSidebarProvider.viewType,
    sidebarProvider
  );

  // Status bar toggle
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.command = 'terminal-sfx.toggle';
  updateStatusBar(statusBar, sfxManager.isEnabled());
  statusBar.show();

  // React to config changes — keep all UIs in sync
  const configWatcher = vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration('terminalSfx')) {
      updateStatusBar(statusBar, sfxManager.isEnabled());
      sidebarProvider.refresh();
      SfxLibraryPanel.refreshIfOpen();
    }
  });

  context.subscriptions.push(sfxManager, monitor, openLibraryCmd, selectFileCmd, toggleCmd, statusBar, configWatcher, sidebarRegistration);
}

function updateStatusBar(item: vscode.StatusBarItem, enabled: boolean): void {
  item.text = enabled ? '$(unmute) SFX' : '$(mute) SFX';
  item.tooltip = enabled
    ? 'Terminal Sound Effects: Enabled (click to disable)'
    : 'Terminal Sound Effects: Disabled (click to enable)';
}

export function deactivate() {}
