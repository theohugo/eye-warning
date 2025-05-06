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
  let pokemonId = -1;

  if (usePokemon) {
    // Mode Pokémon : on choisit un sprite externe
    pokemonId = Math.floor(Math.random() * 898) + 1;
    const spriteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemonId}.png`;
    imgUri = vscode.Uri.parse(spriteUrl);
    label  = `Pokémon n°${pokemonId}`;
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

  // Création du Webview (scripts activés)
  const panel = vscode.window.createWebviewPanel(
    'eyeWarning',
    '👁️ Eye Warning',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      localResourceRoots: localRoots
    }
  );

  // Conversion URI Webview pour local
  if (!usePokemon) {
    imgUri = panel.webview.asWebviewUri(imgUri);
  }

  panel.webview.html = `<!DOCTYPE html>
<html>
<head>
  <style>
    html, body {
      margin:0; padding:0;
      height:100%; width:100%;
      background:#1e1e1e; color:#ddd;
      font-family:sans-serif;
      display:flex; flex-direction:column;
      justify-content:center; align-items:center;
    }
    .container {
      position:relative;
      display:flex; justify-content:center; align-items:center;
    }
    .pokemon {
      width:200%; image-rendering:pixelated;
    }
    img { max-width:100%; max-height:100%; object-fit:contain; }
    .bubble {
      position:absolute; top:-30%; left:50%;
      transform:translateX(-50%);
      background:white; color:black;
      padding:8px 12px; border-radius:12px;
      font-size:14px; white-space:nowrap;
      box-shadow:0 2px 6px rgba(0,0,0,0.3);
    }
    .bubble::after {
      content:""; position:absolute; bottom:-10px; left:50%;
      transform:translateX(-50%);
      border-width:10px 8px 0 8px; border-style:solid;
      border-color:white transparent transparent transparent;
    }
    .game {
      margin-top:16px; padding:16px;
      background:#252526; border:2px solid #3c3c3c;
      border-radius:8px; box-shadow:0 4px 8px rgba(0,0,0,0.5);
      display:flex; flex-direction:column; align-items:center;
    }
    #lives {
      background:#007acc; color:#fff;
      padding:4px 8px; border-radius:4px;
      font-weight:bold; margin-bottom:12px;
    }
    #boxes {
      display:flex; gap:8px; margin-bottom:12px;
    }
    .letter-box {
      width:32px; height:32px; text-align:center;
      font-size:18px; background:#1e1e1e; color:#ddd;
      border:1px solid #3c3c3c; border-radius:4px;
      outline:none;
    }
    .letter-box:disabled {
      background:#3c3c3c; color:#fff; font-weight:bold;
    }
    #result {
      height:20px; font-size:16px; color:#ffd700;
      margin-bottom:8px;
    }
    .filename {
      margin-top:12px; font-size:14px; color:#888;
    }
  </style>
</head>
<body>
  <div class="container">
    <img src="${imgUri}" class="${usePokemon?'pokemon':''}" />
    ${usePokemon?`<div class="bubble">Attention à tes yeux !</div>`:``}
  </div>
  ${usePokemon?`
  <div class="game">
    <div id="lives">Vies restantes : 3</div>
    <div id="boxes"></div>
    <div id="result"></div>
  </div>`:``}
  <div class="filename">${label}</div>

  <script>
    (function(){
      function normalize(s){ return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); }
      function levenshtein(a,b){
        const m=a.length,n=b.length;
        const dp=Array(m+1).fill(null).map(()=>Array(n+1).fill(0));
        for(let i=0;i<=m;i++) dp[i][0]=i;
        for(let j=0;j<=n;j++) dp[0][j]=j;
        for(let i=1;i<=m;i++){
          for(let j=1;j<=n;j++){
            const cost=a[i-1]===b[j-1]?0:1;
            dp[i][j]=Math.min(dp[i-1][j]+1,dp[i][j-1]+1,dp[i-1][j-1]+cost);
          }
        }
        return dp[m][n];
      }

      ${usePokemon?`
      let lives=3, answer='', hints=0;
      const livesEl=document.getElementById('lives');
      const boxesEl=document.getElementById('boxes');
      const resEl=document.getElementById('result');

      fetch('https://pokeapi.co/api/v2/pokemon-species/${pokemonId}')
        .then(r=>r.json()).then(data=>{
          const fr = data.names.find(n=>n.language.name==='fr');
          answer = normalize(fr?fr.name:data.name);
          // création des cases
          for(let i=0;i<answer.length;i++){
            const inp=document.createElement('input');
            inp.type='text'; inp.maxLength=1;
            inp.className='letter-box';
            inp.dataset.idx=i;
            inp.addEventListener('keydown',e=>{
              if(e.key==='Backspace'){
                if(inp.value){
                  inp.value='';
                } else {
                  const prev=document.querySelector(\`.letter-box[data-idx="\${i-1}"]\`);
                  if(prev){
                    prev.value=''; prev.focus();
                  }
                }
                e.preventDefault();
              } else if(/^[a-zA-Z]$/.test(e.key)){
                inp.value=e.key.toUpperCase();
                e.preventDefault();
                const next=document.querySelector(\`.letter-box[data-idx="\${i+1}"]\`);
                if(next) next.focus();
              } else if(e.key==='Enter'){
                handle();
              }
            });
            boxesEl.appendChild(inp);
          }
        });

      function handle(){
        const guess=Array.from(document.querySelectorAll('.letter-box'))
          .map(i=>i.value||'').join('');
        const norm=normalize(guess);
        const dist=levenshtein(norm,answer);
        const ratio=1-dist/Math.max(norm.length,answer.length);
        if(norm===answer||ratio>=0.8){
          resEl.textContent='🎉 Bravo ! C’est '+answer.charAt(0).toUpperCase()+answer.slice(1);
          document.querySelectorAll('.letter-box').forEach(i=>i.disabled=true);
        } else {
          lives--; hints=Math.min(hints+1,answer.length);
          // révèle next lettre
          const toReveal=document.querySelector(\`.letter-box[data-idx="\${hints-1}"]\`);
          if(toReveal){
            toReveal.value=answer[hints-1].toUpperCase();
            toReveal.disabled=true;
          }
          // efface tout ce qui reste
          document.querySelectorAll('.letter-box:not(:disabled)')
            .forEach(i=>i.value='');
          livesEl.textContent='Vies restantes : '+lives;
          if(lives>0){
            resEl.textContent='❌ Essayez encore !';
          } else {
            resEl.textContent='💡 C’était '+answer.charAt(0).toUpperCase()+answer.slice(1);
            document.querySelectorAll('.letter-box').forEach(i=>i.disabled=true);
          }
        }
      }
      `:``}
    })();
  </script>
</body>
</html>`;
}
