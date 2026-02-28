import { ChildProcess, execFile } from 'child_process';
import * as os from 'os';

const MAX_PLAYBACK_MS = 20_000;

export interface PlaybackOptions {
  filePath: string;
  volume: number; // 0–100
}

function killAfterTimeout(proc: ChildProcess): void {
  const timer = setTimeout(() => { if (!proc.killed) proc.kill(); }, MAX_PLAYBACK_MS);
  proc.on('exit', () => clearTimeout(timer));
}

export function playSound(options: PlaybackOptions): void {
  const { filePath, volume } = options;
  const platform = os.platform();

  if (platform === 'darwin') {
    // afplay -v takes a float: 0.0 = silent, 1.0 = normal, 2.0 = double
    const vol = String(Math.max(0, volume) / 50);
    killAfterTimeout(execFile('afplay', ['-v', vol, filePath], logError));
  } else if (platform === 'linux') {
    tryLinuxPlayers(filePath, volume);
  } else if (platform === 'win32') {
    playWindows(filePath);
  }
}

function tryLinuxPlayers(filePath: string, volume: number): void {
  const players = [
    {
      cmd: 'paplay',
      args: ['--volume', String(Math.round((volume / 100) * 65536)), filePath],
    },
    {
      cmd: 'aplay',
      args: [filePath],
    },
    {
      cmd: 'mpv',
      args: ['--no-video', `--volume=${volume}`, filePath],
    },
  ];

  function tryNext(index: number): void {
    if (index >= players.length) return;
    const player = players[index];
    const proc = execFile(player.cmd, player.args, (err) => {
      if (err) tryNext(index + 1);
    });
    killAfterTimeout(proc);
  }

  tryNext(0);
}

function playWindows(filePath: string): void {
  if (filePath.endsWith('.wav')) {
    const script = `(New-Object System.Media.SoundPlayer '${filePath.replace(/'/g, "''")}').PlaySync()`;
    killAfterTimeout(execFile('powershell', ['-NoProfile', '-Command', script], logError));
  } else {
    killAfterTimeout(execFile(
      'powershell',
      ['-NoProfile', '-Command', `Start-Process wmplayer -ArgumentList '"${filePath}"' -Wait`],
      logError
    ));
  }
}

function logError(err: Error | null): void {
  if (err) {
    console.error('[Terminal Sound Effects] Playback error:', err.message);
  }
}
