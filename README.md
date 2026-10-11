# Mythos Launcher / Mythos Client

Der Mythos Launcher ist ein Fork des [NoRisk Client Launchers](https://github.com/NoRiskClient/noriskclient-launcher)
(GPL-3.0) von Mythoscraft (MinePro641). Lizenz und Copyright-Hinweise der Originalautoren bleiben erhalten;
dieser Fork steht ebenfalls unter der [GPL-3.0](LICENSE). Was geändert wurde, steht in [NOTICE.md](NOTICE.md).

- `src/`, `src-tauri/`: der Launcher (Tauri, React, Rust), umbenannt auf Mythos, mit Cosmetics, Creator-Programm und Creator-Codes.
- `mythos-mod/`: eigene Fabric-Mod (Minecraft 1.21.11) mit Mythos-Logo neben dem Namen, Plus, Währung, Capes und `/mcc`.
- `supabase/`: Mythos-Server (Edge Function `mcc` und Datenbank), wird von `.github/workflows/server.yml` bereitgestellt.

"NoRisk" und die NoRisk-Logos sind Marken von NoRisk und nicht Teil der GPL; sie wurden ersetzt.
Mythos Client ist kein offizielles Produkt von NoRisk und steht in keiner Verbindung zu NoRisk.
Fehler bitte als [Issue in diesem Repository](https://github.com/lluananonym-cloud/mythos-client/issues) melden.

---

## Issues

If you notice any bugs or missing features, please open an issue [here](https://github.com/lluananonym-cloud/mythos-client/issues).

## License
This code is originally forked and still uses a small amount of code from [LiquidLauncher](https://github.com/CCBlueX/LiquidLauncher).

Therefore, this project is also subject to the [GNU General Public License v3.0](LICENSE). This does only apply for source code located directly in this clean repository. During the development and compilation process, additional source code may be used to which we have obtained no rights. Such code is not covered by the GPL license.
This project entirely or partially for free and even commercially. However, please consider the following:

- **You must disclose the source code of your modified work and the source code you took from this project. This means you are not allowed to use code from this project (even partially) in a closed-source (or even obfuscated) application.**
- **Your modified application must also be licensed under the GPL** 

Do the above and share your source code with everyone; just like we do.

## Compile it yourself!

### Prerequisites
- **Node.js** (v18 or higher) - [Download here](https://nodejs.org/en/download)
- **Rust** (latest stable) - [Install here](https://www.rust-lang.org/tools/install)
- **Yarn** package manager - `npm install -g yarn`

### Setup Instructions
1. Clone the repository:
   ```bash
   git clone --recurse-submodules https://github.com/lluananonym-cloud/mythos-client
   cd noriskclient-launcher
   ```

2. Install dependencies:
   ```bash
   yarn install
   ```

3. Start development mode:
   ```bash
   yarn tauri dev
   ```

4. Build for production:
   ```bash
   yarn tauri build
   ```

## Contributing
We appreciate contributions. So if you want to support us, feel free to make changes to NoRisk source code and submit a pull request.
