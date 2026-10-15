(() => {
  const button = document.getElementById('installAppBtn');
  const hint = document.getElementById('installHint');
  const instructions = document.getElementById('installInstructions');
  const display = matchMedia('(display-mode: standalone)');
  let deferredPrompt = null, installed = false;
  function update() {
    const runningAsApp = installed || display.matches || navigator.standalone === true;
    button.hidden = runningAsApp || !deferredPrompt;
    instructions.hidden = runningAsApp;
    hint.textContent = runningAsApp ? 'ติดตั้งแล้ว เปิดใช้งานจากหน้าจอหลักได้เลย' : deferredPrompt ? 'ติดตั้งบนหน้าจอหลัก แล้วเปิดใช้งานเหมือนแอปได้เลย' : 'เปิดเมนูเบราว์เซอร์ แล้วเลือก “ติดตั้งแอป” หรือ “เพิ่มลงในหน้าจอหลัก”';
    if (!window.isSecureContext && !runningAsApp) hint.textContent = 'เปิดเว็บผ่านลิงก์ HTTPS ก่อน เพื่อติดตั้งลงหน้าจอหลัก';
  }
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); deferredPrompt = event; update(); });
  window.addEventListener('appinstalled', () => { installed = true; deferredPrompt = null; update(); });
  display.addEventListener('change', update);
  button.onclick = async () => {
    const prompt = deferredPrompt;
    if (!prompt) return;
    deferredPrompt = null; button.disabled = true;
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === 'accepted') { button.hidden = true; hint.textContent = 'ยืนยันแล้ว กำลังติดตั้งแอป'; }
      else update();
    } catch (_) { update(); }
    finally { button.disabled = false; }
  };
  update();
  if ('serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {
      // Browser-menu installation remains available when worker registration fails.
    });
  }
})();
