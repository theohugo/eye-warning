# eye-warning

This README provides an overview of the **customizable commands**, **installation from GitHub**, and **how to build and test** the extension.

---

## Customizable Commands

* **Eye Warning: Set Interval** (`eye-warning.setInterval`)

  * Change the **interval** (in minutes) between each warning popup.
* **Eye Warning: Set Image Folder** (`eye-warning.setImageFolder`)

  * Define the **absolute path** to the folder containing your `.png` images.

> **Tip**: Open the Command Palette with `Ctrl+Shift+P` and start typing the command name.

---

## Installation from GitHub

1. **Clone** the repository:

   ```bash
   git clone https://github.com/theohugo/eye-warning.git
   cd eye-warning
   ```
2. **Install Node.js** (v14 or higher):

   * Download and install from [https://nodejs.org](https://nodejs.org)
3. **Install dependencies**:

   ```bash
   npm install
   ```

---

## Build & Launch

1. **Compile** the TypeScript code:

   ```bash
   npm run compile
   ```
2. **Open** the project in VS Code:

   ```bash
   code .
   ```
3. **Start Debugging**:

   * Press `F5` or go to **Run and Debug** and select **Run Extension**.
   * A new **Extension Development Host** window will open.

4. **Create reel version**:
 ```bash
  vsce package
   ```
---

## Testing & Usage

* The **Status Bar** displays a live **countdown** until the next warning.
* When the countdown reaches zero, a **Webview** opens with a random image from the configured folder.
* You can **adjust the interval** or **change the image folder** at any time using their respective commands.

---

Enjoy using **eye-warning** and don’t forget to take breaks! 🎉
