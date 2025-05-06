// src/extension.ts
import * as vscode from 'vscode';
import * as fs     from 'fs';
import * as path   from 'path';

let nextShow: number;
let statusBar: vscode.StatusBarItem;
let showTimer: NodeJS.Timeout;
let countdownTimer: NodeJS.Timeout;

// Récupère récursivement tous les .png d’un dossier
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

  // --- Commande : Set Interval ---
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

  // --- Commande : Set Image Folder ---
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

  // --- Commande : Toggle Pokémon Mode ---
  const togglePokemonCmd = vscode.commands.registerCommand('eye-warning.togglePokemon', async () => {
    const cfg     = vscode.workspace.getConfiguration('eye-warning');
    const current = cfg.get<boolean>('usePokemon', false);
    await cfg.update('usePokemon', !current, vscode.ConfigurationTarget.Global);
    vscode.window.showInformationMessage(`Pokémon Mode ${!current ? 'activé' : 'désactivé'}.`);
    vscode.commands.executeCommand('workbench.action.reloadWindow');
  });
  context.subscriptions.push(togglePokemonCmd);

  // --- StatusBar pour le compte-à-rebours ---
  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.show();
  context.subscriptions.push(statusBar);

  // Lecture des settings
  const cfg         = vscode.workspace.getConfiguration('eye-warning');
  const intervalMin = cfg.get<number>('interval', 20)!;
  const folderPath  = cfg.get<string>('imageFolder', '')!;
  const usePokemon  = cfg.get<boolean>('usePokemon', false)!;
  const intervalMs  = intervalMin * 60 * 1000;
  nextShow = Date.now() + intervalMs;

  // Lancement des timers
  showPanel(context, folderPath, usePokemon);
  showTimer      = setInterval(() => showPanel(context, folderPath, usePokemon), intervalMs);
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

function showPanel(
  context: vscode.ExtensionContext,
  folderPath: string,
  usePokemon: boolean
) {
  // Met à jour le prochain affichage
  const cfg         = vscode.workspace.getConfiguration('eye-warning');
  const intervalMin = cfg.get<number>('interval', 20)!;
  nextShow = Date.now() + intervalMin * 60000;

  // Prépare URI / label / ressources locales
  let imgUri: vscode.Uri;
  let label: string;
  let localRoots: vscode.Uri[] = [];

  if (usePokemon) {
    // Mode Pokémon : on choisit un sprite externe
    const id        = Math.floor(Math.random() * 898) + 1;
    const spriteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
    imgUri = vscode.Uri.parse(spriteUrl);
    label  = `Pokémon n°${id}`;
  } else {
    // Mode images locales
    const defaultFolder = path.join(context.extensionPath, 'images');
    const baseFolder    = path.isAbsolute(folderPath) && folderPath !== ''
      ? folderPath
      : defaultFolder;

    let pics = getAllPngFiles(baseFolder);
    if (pics.length === 0 && baseFolder !== defaultFolder) {
      pics = getAllPngFiles(defaultFolder);
    }
    if (pics.length === 0) {
      return; // rien à afficher
    }

    const pickPath = pics[Math.floor(Math.random() * pics.length)];
    imgUri         = vscode.Uri.file(pickPath);
    label          = path.basename(pickPath);
    localRoots     = [vscode.Uri.file(path.dirname(pickPath))];
  }

  // Création du Webview
  const panel = vscode.window.createWebviewPanel(
    'eyeWarning',
    '👁️ Eye Warning',
    vscode.ViewColumn.One,
    {
      enableScripts: false,
      localResourceRoots: localRoots
    }
  );

  // Conversion en URI Webview pour les images locales
  if (!usePokemon) {
    imgUri = panel.webview.asWebviewUri(imgUri);
  }

  // HTML/CSS avec bulle pour le Pokémon
  panel.webview.html = `<!DOCTYPE html>
<html>
<head>
  <style>
    html, body {
      margin:0; padding:0;
      height:100%; width:100%;
      display:flex; flex-direction:column;
      justify-content:center; align-items:center;
      background:#1e1e1e;
    }
    .container {
      position: relative;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    img {
      max-width:100%; max-height:100%;
      object-fit:contain;
    }
    /* agrandit le pokémon en pixel-art de 200% */
    .pokemon {
      width: 200%;
      image-rendering: pixelated;
    }
    /* bulle de dialogue centrée un peu plus à gauche */
    .bubble {
      position: absolute;
      top: -20%;
      left: 50%;
      transform: translateX(-50%);
      background: white;
      color: black;
      padding: 8px 12px;
      border-radius: 12px;
      font-size: 14px;
      white-space: nowrap;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    }
    .bubble::after {
      content: "";
      position: absolute;
      bottom: -10px;
      left: 50%;
      transform: translateX(-50%);
      border-width: 10px 8px 0 8px;
      border-style: solid;
      border-color: white transparent transparent transparent;
    }
    .filename {
      margin-top:12px;
      font-size:14px;
      color:#888;
    }
  </style>
</head>
<body>
  <div class="container">
    <img src="${imgUri}" class="${usePokemon ? 'pokemon' : ''}" />
    ${usePokemon
      ? `<div class="bubble">Attention à tes yeux !</div>`
      : ``
    }
  </div>
  <div class="filename">${label}</div>
</body>
</html>`;
}
