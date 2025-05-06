import * as vscode from 'vscode';
import * as fs     from 'fs';
import * as path   from 'path';

let nextShow: number;
let statusBar: vscode.StatusBarItem;
let showTimer: NodeJS.Timeout;
let countdownTimer: NodeJS.Timeout;

// recursively collect all .png files
function getAllPngFiles(dir: string): string[] {
  let files: string[] = [];
  fs.readdirSync(dir, { withFileTypes: true }).forEach(d => {
    const res = path.join(dir, d.name);
    if (d.isDirectory()) {
      files = files.concat(getAllPngFiles(res));
    } else if (d.isFile() && res.endsWith('.png')) {
      files.push(res);
    }
  });
  return files;
}

export function activate(context: vscode.ExtensionContext) {
  console.log('Extension "eye-warning" active!'); 

  // **registerCommand** to set interval
  const setIntervalCmd = vscode.commands.registerCommand('eye-warning.setInterval', async () => {
    const current = vscode.workspace.getConfiguration('eye-warning').get<number>('interval', 20);
    const answer  = await vscode.window.showInputBox({
      prompt: 'Interval in minutes',
      value: String(current),
      validateInput: v => isNaN(+v) || +v < 1 ? 'Enter a number ≥1' : null
    });
    if (answer) {
      await vscode.workspace.getConfiguration('eye-warning')
        .update('interval', +answer, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(`Interval set to ${answer} min`);
      vscode.commands.executeCommand('workbench.action.reloadWindow');
    }
  });
  context.subscriptions.push(setIntervalCmd);

  // **registerCommand** to set image folder
  const setFolderCmd = vscode.commands.registerCommand('eye-warning.setImageFolder', async () => {
    const current = vscode.workspace.getConfiguration('eye-warning').get<string>('imageFolder', '');
    const answer  = await vscode.window.showInputBox({
      prompt: 'Absolute path to your PNG folder (leave empty for default)',
      value: current,
      validateInput: v => v.trim() === '' || path.isAbsolute(v) ? null : 'Enter an absolute path or leave empty'
    });
    if (answer !== undefined) {
      await vscode.workspace.getConfiguration('eye-warning')
        .update('imageFolder', answer, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(`Image folder set to "${answer || 'default'}"`);
      vscode.commands.executeCommand('workbench.action.reloadWindow');
    }
  });
  context.subscriptions.push(setFolderCmd);

  // **create** StatusBar item
  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.show();
  context.subscriptions.push(statusBar);

  // **read** settings
  const cfg         = vscode.workspace.getConfiguration('eye-warning');
  const intervalMin = cfg.get<number>('interval', 20);
  const folderPath  = cfg.get<string>('imageFolder', '');
  const intervalMs  = intervalMin * 60 * 1000;
  nextShow = Date.now() + intervalMs;

  // **start** timers
  showPanel(context, folderPath);
  showTimer      = setInterval(() => showPanel(context, folderPath), intervalMs);
  countdownTimer = setInterval(updateCountdown, 1000);
}

export function deactivate() {
  clearInterval(showTimer);
  clearInterval(countdownTimer);
  statusBar?.hide();
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

// **showPanel** with recursive scan
function showPanel(context: vscode.ExtensionContext, folderPath: string) {
  const defaultFolder = path.join(context.extensionPath, 'images');
  const baseFolder    = (folderPath && path.isAbsolute(folderPath)) ? folderPath : defaultFolder;

  // collect all PNGs
  let pics = getAllPngFiles(baseFolder);
  // fallback to default if empty
  if (pics.length === 0 && baseFolder !== defaultFolder) {
    pics = getAllPngFiles(defaultFolder);
  }
  if (pics.length === 0) { return; }

  // pick random file
  const pickPath = pics[Math.floor(Math.random() * pics.length)];
  const pickName = path.basename(pickPath);
  nextShow = Date.now() + vscode.workspace.getConfiguration('eye-warning').get<number>('interval', 20)! * 60000;

  // create webview
  const panel = vscode.window.createWebviewPanel(
    'eyeWarning', '👁️ Eye Warning', vscode.ViewColumn.One,
    {
      enableScripts: false,
      localResourceRoots: [vscode.Uri.file(path.dirname(pickPath))]
    }
  );
  const src = panel.webview.asWebviewUri(vscode.Uri.file(pickPath));

  panel.webview.html = `<!DOCTYPE html>
<html>
<head>
  <style>
    html, body {
      margin:0; padding:0;
      height:100%; width:100%;
      display:flex; flex-direction:column;
      justify-content:center; align-items:center;
    }
    img {
      max-width:100%; max-height:100%;
      object-fit:contain;
    }
    .filename {
      margin-top:8px; font-size:14px; color:#888;
    }
  </style>
</head>
<body>
  <img src="${src}" />
  <div class="filename">${pickName}</div>
</body>
</html>`;
}
