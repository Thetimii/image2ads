# TikTok Reels (Remotion)

Sechs Reel-Templates, 1080×1920, 30fps.

Reel 1–3: ohne Ton (Sound in der TikTok-App drauflegen).
Reel 4–6: mit Sound-Effekten + dezentem Beat (alles selbst synthetisiert, lizenzfrei, `sfx.py`).

## Fertige Videos
`renders/` – direkt posten.

## Neue Videos mit anderen Bildern
1. Vorher-Foto und image2ad-Output in `public/` legen (Hochformat ist am besten, max. ~1920px hoch).
2. In `src/Reels.tsx` oben das `PAIRS`-Array anpassen (Dateinamen + Name).
3. Texte/Hooks stehen direkt in den `<TikTokText lines={[...]}>` und `<Statement lines={[...]}>` Aufrufen.

## Rendern
```bash
cd tiktok
npm install
npm run studio                                  # Live-Vorschau im Browser
npx remotion render src/index.ts RevealFirst out/reel1.mp4
npx remotion render src/index.ts DesignerVsThis out/reel2.mp4
npx remotion render src/index.ts RateThem out/reel3.mp4
```
Auf dem Mac die Zeile `Config.setBrowserExecutable(...)` in `remotion.config.ts` löschen – Remotion lädt sich dann selbst einen Browser.

## Sound
- `public/sfx/` – Whoosh, Click, Tick, Pop, Bass-Hit, Thud, Ding, Riser, Shutter, Key, Beep, Clack, Notify + `beat.wav`.
- Beat aus/ein: `MUSIC_VOLUME` in `src/lib.tsx` (0 = aus, dann Trending-Sound in TikTok drauflegen).
- Eigene SFX: WAV in `public/sfx/` legen und `<Sfx name="..." at={frame} />` im Template setzen.
- Sounds neu generieren: `python3 sfx.py` (braucht numpy + scipy).

## Templates
- **RevealFirst** (12s) – Ergebnis in Frame 1, dann das Original, zwei Wipes, Comment-Bait am Ende. Hauptformat.
- **DesignerVsThis** (10.5s) – "$400 / 3 Tage" vs. Timer bis 12s. Einziges Template mit klarem CTA-Ende.
- **RateThem** (11s) – 3 Paare schnell geschnitten, "1, 2 oder 3?" für Kommentare.
- **UiDemo** (13s) – Animierte Produkt-Demo: Foto reinziehen → Generate → Scanner + Progress → Ergebnis knallt rein → zwei Whip-Pans → CTA. Mit SFX.
- **KineticType** (11s) – Wort-für-Wort-Slam "your product photos are BORING." → Typewriter → Flash-Cuts mit Shutter → Zähler-Roll auf 12 → Save-Bait. Mit SFX.
- **TheRace** (10s) – Designer-Lane vs. image2ad-Lane als Rennen (Tage/Kosten zählen hoch, AI ist nach 1s fertig) → "same result." → "which would you pick?". Mit SFX.
