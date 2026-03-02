// v86 terminal implementation and DSL profile settings are derived from copy.sh v86:
// https://github.com/copy/v86
(() => {
  const screen = document.getElementById("screen");
  const statusEl = document.getElementById("status");
  const capture = document.getElementById("capture");
  const keyOverlay = document.getElementById("keys");
  const keyboardBtn = document.getElementById("keyboard");
  const installPanel = document.getElementById("installPanel");
  const installDslBtn = document.getElementById("installDslBtn");
  const reinstallDslBtn = document.getElementById("reinstallDslBtn");
  const clearDslBtn = document.getElementById("clearDslBtn");
  const installProgressWrap = document.getElementById("installProgressWrap");
  const installProgressFill = document.getElementById("installProgressFill");
  const installProgressText = document.getElementById("installProgressText");

  const DSL_ISO_URL = "https://i.copy.sh/dsl-4.11.rc2.iso";
  const OPFS_ISO_FILE = "agent1c-v86-dsl-iso-v1.iso";
  const OPFS_STATE_VERSION = "dsl_iso-v1";

  let emulator = null;
  let installInProgress = false;
  let cachedIsoBuffer = null;

  const setStatus = (text) => {
    if (statusEl) statusEl.textContent = text;
  };

  const setInstallProgress = (loaded, total, extraText = "") => {
    if (!installProgressWrap || !installProgressFill || !installProgressText) return;
    installProgressWrap.hidden = false;
    let pctText = "";
    if (Number.isFinite(total) && total > 0) {
      const pct = Math.max(0, Math.min(100, Math.round((loaded / total) * 100)));
      installProgressFill.style.width = `${pct}%`;
      pctText = `${pct}%`;
    } else {
      installProgressFill.style.width = "0%";
    }
    const mbLoaded = (loaded / (1024 * 1024)).toFixed(1);
    const mbTotal = Number.isFinite(total) && total > 0 ? (total / (1024 * 1024)).toFixed(1) : "?";
    installProgressText.textContent = `${extraText || "Downloading DSL image..."} ${pctText} (${mbLoaded} / ${mbTotal} MB)`.trim();
  };

  const setInstallPanelVisible = (visible) => {
    if (!installPanel) return;
    installPanel.classList.toggle("hidden", !visible);
  };

  const isOpfsSupported = () => Boolean(navigator.storage && navigator.storage.getDirectory);

  const getOpfsRoot = async () => navigator.storage.getDirectory();

  const getOrCreateStateDir = async () => {
    const root = await getOpfsRoot();
    return root.getDirectoryHandle("agent1c_v86", { create: true });
  };

  const readInstalledVersion = async () => {
    try {
      const dir = await getOrCreateStateDir();
      const handle = await dir.getFileHandle("version.txt");
      const file = await handle.getFile();
      return (await file.text()).trim();
    } catch (_) {
      return "";
    }
  };

  const writeInstalledVersion = async (version) => {
    const dir = await getOrCreateStateDir();
    const handle = await dir.getFileHandle("version.txt", { create: true });
    const writable = await handle.createWritable();
    await writable.write(String(version || ""));
    await writable.close();
  };

  const clearInstalledDsl = async () => {
    const dir = await getOrCreateStateDir();
    try {
      await dir.removeEntry(OPFS_ISO_FILE);
    } catch (_) {}
    try {
      await dir.removeEntry("version.txt");
    } catch (_) {}
    cachedIsoBuffer = null;
  };

  const readDslFromOpfs = async () => {
    try {
      const dir = await getOrCreateStateDir();
      const version = await readInstalledVersion();
      if (version !== OPFS_STATE_VERSION) return null;
      const handle = await dir.getFileHandle(OPFS_ISO_FILE);
      const file = await handle.getFile();
      if (!file || file.size <= 0) return null;
      return await file.arrayBuffer();
    } catch (_) {
      return null;
    }
  };

  const writeDslToOpfs = async (buffer) => {
    const dir = await getOrCreateStateDir();
    const handle = await dir.getFileHandle(OPFS_ISO_FILE, { create: true });
    const writable = await handle.createWritable();
    await writable.write(buffer);
    await writable.close();
    await writeInstalledVersion(OPFS_STATE_VERSION);
  };

  const fetchDslIso = async () => {
    const response = await fetch(DSL_ISO_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`DSL image download failed (${response.status})`);
    }

    const total = Number(response.headers.get("content-length")) || 0;
    if (!response.body) {
      const buffer = await response.arrayBuffer();
      setInstallProgress(buffer.byteLength, buffer.byteLength || total, "Downloading DSL image...");
      return buffer;
    }

    const reader = response.body.getReader();
    const chunks = [];
    let loaded = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      chunks.push(value);
      loaded += value.byteLength;
      setInstallProgress(loaded, total, "Downloading DSL image...");
    }

    const result = new Uint8Array(loaded);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return result.buffer;
  };

  const showInstallRequired = (message) => {
    setInstallPanelVisible(true);
    if (installDslBtn) installDslBtn.disabled = false;
    if (reinstallDslBtn) reinstallDslBtn.disabled = false;
    if (clearDslBtn) clearDslBtn.disabled = false;
    if (installProgressWrap) installProgressWrap.hidden = true;
    if (installProgressFill) installProgressFill.style.width = "0%";
    setStatus(message || "Your distro has not been downloaded yet. Install DSL to continue.");
  };

  const bootDslFromIso = async (isoBuffer) => {
    if (emulator) return emulator;
    setInstallPanelVisible(false);
    setStatus("Preparing Damn Small Linux (local install)...");

    emulator = new window.V86Starter({
      wasm_path: "../../vendor/v86/v86.wasm",
      screen_container: screen,
      bios: { url: "../../vendor/v86/bios/seabios.bin" },
      vga_bios: { url: "../../vendor/v86/bios/vgabios.bin" },
      cdrom: { buffer: isoBuffer },
      autostart: true,
      memory_size: 268435456,
      vga_memory_size: 8 * 1024 * 1024,
    });

    emulator.add_listener("download-progress", (evt) => {
      if (!evt.lengthComputable) {
        setStatus("Loading DSL assets...");
        return;
      }
      const pct = Math.min(100, Math.round((evt.loaded / evt.total) * 100));
      setStatus(`Loading DSL assets... ${pct}%`);
    });

    emulator.add_listener("download-error", () => {
      setStatus("Failed to load v86/DSL assets.");
    });

    emulator.add_listener("emulator-loaded", () => {
      setStatus("Damn Small Linux booting...");
    });

    return emulator;
  };

  const ensureDslInstalledAndBoot = async () => {
    if (!window.V86Starter) {
      setStatus("v86 engine not available.");
      return;
    }
    if (!isOpfsSupported()) {
      showInstallRequired("This browser does not support local OPFS storage for DSL.");
      if (installDslBtn) installDslBtn.disabled = true;
      return;
    }

    setStatus("Checking local Damn Small Linux install...");
    cachedIsoBuffer = await readDslFromOpfs();
    if (!cachedIsoBuffer) {
      showInstallRequired("Your distro has not been downloaded yet. Install DSL to continue.");
      return;
    }

    await bootDslFromIso(cachedIsoBuffer);
  };

  const installDsl = async () => {
    if (installInProgress) return;
    installInProgress = true;
    if (installDslBtn) installDslBtn.disabled = true;
    if (reinstallDslBtn) reinstallDslBtn.disabled = true;
    if (clearDslBtn) clearDslBtn.disabled = true;
    try {
      setStatus("Downloading Damn Small Linux install image...");
      const buffer = await fetchDslIso();
      setInstallProgress(buffer.byteLength, buffer.byteLength, "Saving local DSL install...");
      await writeDslToOpfs(buffer);
      cachedIsoBuffer = buffer;
      if (installProgressText) {
        installProgressText.textContent = "Damn Small Linux installed locally. Booting...";
      }
      setStatus("Damn Small Linux installed locally. Booting...");
      await bootDslFromIso(buffer);
    } catch (error) {
      console.error(error);
      showInstallRequired(`Install failed: ${error?.message || "Unknown error"}`);
    } finally {
      installInProgress = false;
      if (!emulator) {
        if (installDslBtn) installDslBtn.disabled = false;
        if (reinstallDslBtn) reinstallDslBtn.disabled = false;
        if (clearDslBtn) clearDslBtn.disabled = false;
      }
    }
  };

  const reinstallDsl = async () => {
    if (installInProgress) return;
    try {
      setStatus("Clearing local DSL install...");
      await clearInstalledDsl();
    } catch (error) {
      console.error(error);
      showInstallRequired(`Failed to clear local DSL: ${error?.message || "Unknown error"}`);
      return;
    }
    await installDsl();
  };

  const clearDslOnly = async () => {
    if (installInProgress) return;
    try {
      setStatus("Clearing local DSL install...");
      await clearInstalledDsl();
      showInstallRequired("Local DSL install cleared. Install DSL to continue.");
    } catch (error) {
      console.error(error);
      showInstallRequired(`Failed to clear local DSL: ${error?.message || "Unknown error"}`);
    }
  };

  const focusScreen = () => {
    if (capture) capture.focus();
    screen?.focus();
    emulator?.keyboard_set_status?.(true);
  };

  const sendSpecialKey = (key) => {
    const map = {
      Enter: 13,
      Backspace: 8,
      Tab: 9,
      Escape: 27,
      ArrowUp: 38,
      ArrowDown: 40,
      ArrowLeft: 37,
      ArrowRight: 39,
      Insert: 45,
      Delete: 46,
      Home: 36,
      End: 35,
      PageUp: 33,
      PageDown: 34,
    };
    const keyCode = map[key];
    if (!keyCode) return false;
    if (key === "Enter" && emulator?.keyboard_send_scancodes) {
      emulator.keyboard_send_scancodes([0x1c, 0x9c]);
    } else {
      emulator?.keyboard_send_keys?.([keyCode]);
    }
    return true;
  };

  if (!screen) return;
  screen.tabIndex = 0;

  document.addEventListener("pointerdown", focusScreen);
  screen.addEventListener("pointerdown", focusScreen);

  if (capture) {
    capture.tabIndex = 0;
    capture.setAttribute("aria-label", "Terminal input capture");
    capture.setAttribute("autocapitalize", "off");
    capture.setAttribute("autocomplete", "off");
    capture.setAttribute("autocorrect", "off");
    capture.setAttribute("inputmode", "text");
    capture.spellcheck = false;
    capture.addEventListener("pointerdown", focusScreen);
    capture.addEventListener("touchstart", focusScreen, { passive: true });
    capture.addEventListener("keydown", (e) => {
      const sentSpecial = sendSpecialKey(e.key);
      if (!sentSpecial && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        emulator?.keyboard_send_text?.(e.key);
      }
      if (keyOverlay) {
        keyOverlay.textContent = `Key: ${e.key}  Code: ${e.code || "n/a"}  KeyCode: ${e.keyCode || 0}`;
      }
      e.preventDefault();
    });
    capture.addEventListener("input", (e) => {
      const value = e.target.value;
      if (!value) return;
      emulator?.keyboard_send_text?.(value);
      if (keyOverlay) {
        keyOverlay.textContent = `Input: ${value}`;
      }
      e.target.value = "";
    });
  }

  if (keyboardBtn && capture) {
    const showKeyboard = () => {
      focusScreen();
      setTimeout(() => capture.focus(), 0);
    };
    keyboardBtn.addEventListener("click", showKeyboard);
    keyboardBtn.addEventListener("touchstart", (e) => {
      e.preventDefault();
      showKeyboard();
    }, { passive: false });
  }

  installDslBtn?.addEventListener("click", () => {
    void installDsl();
  });
  reinstallDslBtn?.addEventListener("click", () => {
    void reinstallDsl();
  });
  clearDslBtn?.addEventListener("click", () => {
    void clearDslOnly();
  });

  void ensureDslInstalledAndBoot();
})();
