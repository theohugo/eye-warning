import * as vscode from 'vscode';
import * as fs     from 'fs';
import * as path   from 'path';

let nextShow: number;
let statusBar: vscode.StatusBarItem;
let showTimer: NodeJS.Timeout;
let countdownTimer: NodeJS.Timeout;

export function activate(context: vscode.ExtensionContext) {
    console.log('Extension "eye-warning" active!');

    // register command to set interval
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

    // register command to set image folder
    const setFolderCmd = vscode.commands.registerCommand('eye-warning.setImageFolder', async () => {
        const current = vscode.workspace.getConfiguration('eye-warning').get<string>('imageFolder', '');
        const answer  = await vscode.window.showInputBox({
            prompt: 'Absolute path to your PNG folder (leave empty to use default)',
            value: current,
            validateInput: v => v.trim().length === 0 || path.isAbsolute(v) ? null : 'Enter an absolute path or leave empty'
        });
        if (answer !== undefined) {
            await vscode.workspace.getConfiguration('eye-warning')
                .update('imageFolder', answer, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(`Image folder set to "${answer || 'default images folder'}"`);
            vscode.commands.executeCommand('workbench.action.reloadWindow');
        }
    });
    context.subscriptions.push(setFolderCmd);

    // create status bar item
    statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBar.show();
    context.subscriptions.push(statusBar);

    // read settings
    const cfg         = vscode.workspace.getConfiguration('eye-warning');
    const intervalMin = cfg.get<number>('interval', 20);
    const folderPath  = cfg.get<string>('imageFolder', '');
    const intervalMs  = intervalMin * 60 * 1000;
    nextShow = Date.now() + intervalMs;

    // start timers
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

function showPanel(context: vscode.ExtensionContext, folderPath: string) {
    // determine base folder: absolute or fallback
    const defaultFolder = path.join(context.extensionPath, 'images');
    let imgFolder      = (folderPath && path.isAbsolute(folderPath)) ? folderPath : defaultFolder;

    // read PNG files, fallback if empty
    let pics: string[] = [];
    try { pics = fs.readdirSync(imgFolder).filter(f => f.endsWith('.png')); } catch {}
    if (pics.length === 0 && imgFolder !== defaultFolder) {
        imgFolder = defaultFolder;
        try { pics = fs.readdirSync(imgFolder).filter(f => f.endsWith('.png')); } catch { return; }
    }
    if (pics.length === 0) { return; }

    const pick = pics[Math.floor(Math.random() * pics.length)];
    nextShow = Date.now() + vscode.workspace.getConfiguration('eye-warning').get<number>('interval', 20)! * 60000;

    const panel = vscode.window.createWebviewPanel(
        'eyeWarning', '👁️ Eye Warning', vscode.ViewColumn.One,
        {
            enableScripts: false,
            localResourceRoots: [vscode.Uri.file(imgFolder)] // allow custom folder
        }
    );

    const fileUri = vscode.Uri.file(path.join(imgFolder, pick));
    const src     = panel.webview.asWebviewUri(fileUri);

    panel.webview.html = `<!DOCTYPE html>
<html>
<head>
    <style>
        html, body {
            margin: 0; padding: 0;
            height: 100%; width: 100%;
            display: flex; justify-content: center; align-items: center;
        }
        img {
            max-width: 100%; max-height: 100%;
            object-fit: contain;
        }
        .filename {
            position: absolute; bottom: 10px;
            font-size: 14px; color: #888;
        }
    </style>
</head>
<body>
    <img src="${src}" />
    <div class="filename">${pick}</div>
</body>
</html>`;
}
