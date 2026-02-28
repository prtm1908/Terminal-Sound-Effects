import * as vscode from 'vscode';

export type ErrorCallback = () => void;

export class TerminalMonitor implements vscode.Disposable {
  private disposable: vscode.Disposable;

  constructor(onError: ErrorCallback) {
    this.disposable = vscode.window.onDidEndTerminalShellExecution((event) => {
      // exitCode undefined = could not be determined (shell integration issue)
      // 0 = success, anything else = failure
      if (event.exitCode !== undefined && event.exitCode !== 0) {
        onError();
      }
    });
  }

  dispose(): void {
    this.disposable.dispose();
  }
}
