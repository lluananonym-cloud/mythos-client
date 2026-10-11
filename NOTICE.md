# Hinweise zu Herkunft und Änderungen

Dieses Programm ist eine veränderte Fassung des NoRisk Client Launchers
(https://github.com/NoRiskClient/noriskclient-launcher), Copyright © NoRisk und Mitwirkende,
der seinerseits Code aus LiquidLauncher (https://github.com/CCBlueX/LiquidLauncher, CCBlueX) enthält.
Beide stehen unter der GNU General Public License v3.0; diese Fassung ebenso (siehe LICENSE).

Geändert von Mythoscraft (MinePro641), ab Oktober 2026:

- Name, Logo, Icons, Farben und Texte auf "Mythos Launcher" / "Mythos Client" umgestellt;
  NoRisk-Marken und -Logos entfernt.
- Automatische Updates über die NoRisk-Server abgeschaltet.
- Neu: Anmeldung beim Mythos-Server, Cosmetics-Editor (auch animierte Capes), Creator-Programm
  mit Bewerbung, Live-Abonnenten und Creator-Codes.
- Eigenes Design: Schrift Outfit, runde Ecken, Mythos-Hintergrund und -Farben.
- Neu: eigene Fabric-Mod `mythos-mod/` und eigener Server `supabase/`.
- Das nicht frei lizenzierte Paket `@noriskclient/nrc-skin-renderer` entfernt; die 3D-Spieleranzeige
  nutzt jetzt einen eigenen Renderer (`src/lib/skin-renderer/`) auf Basis von skinview3d.

Mythos Client ist kein offizielles Produkt von NoRisk und steht in keiner Verbindung zu NoRisk.
Der vollständige Quellcode dieser Fassung: https://github.com/lluananonym-cloud/mythos-client

Schriftart Outfit: © The Outfit Project Authors, SIL Open Font License 1.1 (public/fonts/OFL-Outfit.txt).

skinview3d und skinview-utils: © 2014-2018 Kent Rasmussen, © 2017-2022 Haowei Wen, Sean Boult und
Mitwirkende, MIT-Lizenz (https://github.com/bs-community/skinview3d).
