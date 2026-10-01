# Screenshot provenance

These images are copied into this directory so the paper does not depend on an external image host. New captures were made on 1 October 2026. Existing product captures retain their original content; the two PNG originals were re-encoded as JPEG for page size.

| Image | Origin | What it shows |
| --- | --- | --- |
| `agent1c-ai.jpg` | Fresh capture of [agent1c.ai](https://agent1c.ai/) | Browser desktop at the managed sign-in step; no signed-in session or model conversation. |
| `agent1c-me.jpg` | Fresh capture of [agent1c.me](https://agent1c.me/) | Local Files and Notes windows with the Hitomi companion; model setup skipped. |
| `hitomi-android.jpg` | [Open Hitomi README screenshot](https://raw.githubusercontent.com/Decentricity/hitomi-android/master/docs/hitomi-android-screenshot-latest.png) | Existing Android application UI capture. |
| `hitomi-termux.jpg` | [Hitomi showcase](https://hitomi.love/assets/showcase/terminal.jpg) | Existing Termux action demonstration. |
| `hitomi-google-play.jpg` | Fresh capture of [Google Play listing](https://play.google.com/store/apps/details?id=ai.agent1c.hitomi) | Public 1K+ download badge and installation channel; not a measure of active users. |
| `open-hitomi-fdroid.jpg` | Fresh capture of [F-Droid listing](https://f-droid.org/packages/ai.agent1c.hitomi.open/) | Open-source distribution channel and local Ollama support. |
| `hedgeyos-desktop.jpg` | [HedgeyOS alpha.6 release screenshot](https://github.com/hedgeyos/hedgeyos/releases/download/v0.1.0-alpha.6/hedgeyos-alpha.6-desktop.png) | Existing XFCE desktop capture from the Android alpha release. |
| `hedgeytty-source.jpg` | Fresh capture of [current HedgeyTTY documentation](https://github.com/agent1c-ai/hedgeytty#what-this-fork-adds) | Current fork features, including the Hitomi desktop, dock, and terminal profile. **Source documentation, not a runtime screenshot.** |

## HedgeyTTY capture limitation

The current fork at commit `72e702fb0f6a3d29df674e3ed4f891573b4dfa2f` was built successfully for this paper. Its runtime could not start in the capture environment because local Unix socket creation was denied, and an elevated run was rejected by the execution policy. The paper therefore uses a labelled source capture. The historical upstream Twin screenshot in the repository was not presented as the current HedgeyTTY interface.

Existing screenshots demonstrate the captured versions, not a promise that every planned platform integration has shipped. Screenshot captions distinguish existing release images, live app captures, distribution listings, and development documentation.
