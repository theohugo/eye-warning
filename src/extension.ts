import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

let nextShow: number;
let statusBar: vscode.StatusBarItem;
let showTimer: NodeJS.Timeout;
let countdownTimer: NodeJS.Timeout;

export function activate(context: vscode.ExtensionContext) {
  console.log('Extension "eye-warning" active!'); // English comment

  // **registerCommand** to change interval
  const setIntervalCmd = vscode.commands.registerCommand('eye-warning.setInterval', async () => {
    const current = vscode.workspace.getConfiguration('eye-warning').get<number>('interval', 20);
    const answer = await vscode.window.showInputBox({
      prompt: 'Interval in minutes',
      value: String(current),
      validateInput: v => isNaN(+v) || +v < 1 ? 'Enter a number ≥ 1' : null
    });
    if (answer) {
      await vscode.workspace.getConfiguration('eye-warning')
        .update('interval', +answer, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(`Interval set to ${answer} min`);
      // English comment: reload to apply new interval immediately
      vscode.commands.executeCommand('workbench.action.reloadWindow');
    }
  });
  context.subscriptions.push(setIntervalCmd);

  // **create StatusBar** item
  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.show();
  context.subscriptions.push(statusBar);

  // **read** interval setting
  const intervalMin = vscode.workspace.getConfiguration('eye-warning').get<number>('interval', 20);
  const intervalMs = intervalMin * 60 * 1000;
  nextShow = Date.now() + intervalMs;

  // **start timers**
  showPanel(context);
  showTimer = setInterval(() => showPanel(context), intervalMs);
  countdownTimer = setInterval(updateCountdown, 1000);
}

export function deactivate() {
  clearInterval(showTimer);
  clearInterval(countdownTimer);
  if (statusBar) {
    statusBar.hide();
  }
}

function updateCountdown() {
  const msLeft = nextShow - Date.now();
  if (msLeft <= 0) {
    statusBar.text = `$(eye) Warning incoming…`;
  } else {
    const m = Math.floor(msLeft / 60000);
    const s = Math.floor((msLeft % 60000) / 1000);
    statusBar.text = `$(eye) Prochain avertissement : ${m}m ${s}s`;
  }
}

function showPanel(context: vscode.ExtensionContext) {
  const imgFolder = path.join(context.extensionPath, 'images');
  const pics = fs.readdirSync(imgFolder).filter(f => f.endsWith('.png'));
  if (pics.length === 0) { return; } // English comment

  const pick = pics[Math.floor(Math.random() * pics.length)];
  nextShow = Date.now() + vscode.workspace.getConfiguration('eye-warning').get<number>('interval', 20)! * 60000;

  const panel = vscode.window.createWebviewPanel(
    'eyeWarning',
    '👁️ Eye Warning',
    vscode.ViewColumn.One,
    { enableScripts: false }
  );
  const fileUri = vscode.Uri.file(path.join(imgFolder, pick));
  const src = panel.webview.asWebviewUri(fileUri);
  panel.webview.html = `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;display:flex;justify-content:center;align-items:center;">
    <img src="${src}" style="max-width:100%;max-height:100%;" />
  </body>
</html>`;
}
