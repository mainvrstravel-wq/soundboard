window.createBoardMapping = function ({ getSounds, onSave }) {
  const rows = document.getElementById('mappingRows');
  const message = document.getElementById('mappingMessage');
  const validKey = code => /^(Key[A-Z]|Digit[0-9]|Numpad[0-9])$/.test(code);
  const keyName = code => code?.startsWith('Key') ? code.slice(3) : code?.startsWith('Digit') ? code.slice(5) : code?.startsWith('Numpad') ? 'Num ' + code.slice(6) : '';
  const copy = slots => slots.map(slot => ({ ...slot }));
  let room = null, slots = [], draft = [], saved = false, recording = null;
  const defaults = () => Array.from({ length: 9 }, (_, index) => ({ soundId: getSounds()[index]?.id || '', keyCode: getSounds()[index] ? 'Digit' + (index + 1) : '' }));
  const say = text => { message.textContent = text; };
  function cancelCapture() { if (recording !== null) { recording = null; render(); } }
  function loadRoom(nextRoom) {
    if (nextRoom === room) return false;
    room = nextRoom; saved = false; slots = defaults(); recording = null;
    try {
      const stored = JSON.parse(localStorage.getItem('sb_board_' + room));
      if (stored?.version === 1 && Array.isArray(stored.slots)) {
        const used = new Set();
        slots = Array.from({ length: 9 }, (_, index) => {
          const item = stored.slots[index];
          const soundId = typeof item?.soundId === 'string' ? item.soundId.slice(0, 200) : '';
          const keyCode = soundId && validKey(item?.keyCode) && !used.has(item.keyCode) ? item.keyCode : '';
          if (keyCode) used.add(keyCode);
          return { soundId, keyCode };
        });
        saved = true;
      }
    } catch (_) {}
    draft = copy(slots); say(''); render(); return true;
  }
  function render() {
    if (!room) return;
    const sounds = getSounds();
    rows.replaceChildren();
    draft.forEach((slot, index) => {
      const row = document.createElement('div'); row.className = 'mapping-row';
      const number = document.createElement('span'); number.className = 'mapping-number'; number.textContent = String(index + 1).padStart(2, '0');
      const select = document.createElement('select'); select.setAttribute('aria-label', 'เสียงรายการ ' + (index + 1));
      select.add(new Option('ไม่กำหนดเสียง', ''));
      sounds.forEach(sound => select.add(new Option(sound.emoji + ' ' + sound.label, sound.id)));
      if (slot.soundId && !sounds.some(sound => sound.id === slot.soundId)) select.add(new Option('เสียงเดิมไม่อยู่ในห้องแล้ว', slot.soundId));
      select.value = slot.soundId;
      select.onchange = () => { slot.soundId = select.value; if (!slot.soundId) slot.keyCode = ''; recording = null; say('มีการเปลี่ยนแปลง กดบันทึกเพื่อใช้งาน'); render(); rows.children[index].querySelector('select').focus(); };
      const controls = document.createElement('div'); controls.className = 'mapping-row-controls';
      const key = document.createElement('button'); key.type = 'button'; key.className = 'mapping-key'; key.dataset.slot = index;
      key.textContent = recording === index ? 'กดคีย์…' : (keyName(slot.keyCode) || 'ตั้งคีย์ลัด');
      key.setAttribute('aria-label', 'ตั้งคีย์ลัดรายการ ' + (index + 1) + (slot.keyCode ? ' ปัจจุบัน ' + keyName(slot.keyCode) : ''));
      key.setAttribute('aria-pressed', String(recording === index)); key.disabled = !slot.soundId;
      key.onclick = () => { recording = recording === index ? null : index; say(recording === null ? '' : 'กด A–Z, 0–9 หรือ Numpad · Esc ยกเลิก · Delete ล้างคีย์'); render(); rows.children[index].querySelector('.mapping-key').focus(); };
      const clear = document.createElement('button'); clear.type = 'button'; clear.className = 'mapping-small'; clear.textContent = 'ล้างคีย์'; clear.disabled = !slot.keyCode;
      clear.setAttribute('aria-label', 'ล้างคีย์ลัดรายการ ' + (index + 1)); clear.onclick = () => { slot.keyCode = ''; recording = null; say('ล้างคีย์แล้ว กดบันทึกเพื่อใช้งาน'); render(); };
      controls.append(key, clear);
      row.append(number, select, controls); rows.appendChild(row);
    });
  }
  document.addEventListener('keydown', event => {
    if (recording === null) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (event.repeat) return;
    if (event.code === 'Escape') { cancelCapture(); say('ยกเลิกการตั้งคีย์'); return; }
    const index = recording;
    if (event.code === 'Backspace' || event.code === 'Delete') draft[index].keyCode = '';
    else {
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || !validKey(event.code)) { say('ใช้ A–Z, 0–9 หรือ Numpad เท่านั้น · Space สงวนไว้หยุดเสียง'); return; }
      const conflict = draft.findIndex((slot, other) => other !== index && slot.keyCode === event.code);
      if (conflict >= 0) { say('คีย์ ' + keyName(event.code) + ' ใช้ในรายการ ' + (conflict + 1) + ' แล้ว ล้างคีย์เดิมหรือเลือกคีย์อื่น'); return; }
      draft[index].keyCode = event.code;
    }
    recording = null; say('ตั้งคีย์แล้ว กดบันทึกเพื่อใช้งาน'); render(); rows.children[index].querySelector('.mapping-key').focus();
  }, true);
  document.addEventListener('focusin', event => {
    if (recording === null || event.target.closest('.mapping-key')) return;
    const index = recording; recording = null;
    const button = rows.children[index]?.querySelector('.mapping-key');
    if (button) { button.textContent = keyName(draft[index].keyCode) || 'ตั้งคีย์ลัด'; button.setAttribute('aria-pressed', 'false'); }
    say('ยกเลิกการรับคีย์แล้ว');
  });
  document.getElementById('saveMappingBtn').onclick = () => {
    if (!room) return;
    const sounds = getSounds();
    const missing = draft.findIndex(slot => slot.soundId && !sounds.some(sound => sound.id === slot.soundId));
    if (missing >= 0) { say('เสียงรายการ ' + (missing + 1) + ' ไม่อยู่ในห้องแล้ว กรุณาเลือกเสียงใหม่หรือไม่กำหนดเสียง'); return; }
    try { localStorage.setItem('sb_board_' + room, JSON.stringify({ version: 1, slots: draft })); }
    catch (_) { say('บันทึกไม่ได้ ตรวจสอบว่าบราวเซอร์อนุญาตให้เก็บข้อมูล'); return; }
    slots = copy(draft); saved = true; recording = null; say('บันทึกแล้ว'); render(); onSave();
  };
  document.getElementById('resetMappingBtn').onclick = () => { draft = defaults(); recording = null; say('คืนค่า 9 เสียงแรกแล้ว กดบันทึกเพื่อใช้งาน'); render(); };
  return {
    loadRoom, render, cancelCapture, keyName,
    get saved() { return saved; },
    getShortcut: sound => saved ? slots.find(slot => slot.soundId === sound.id && slot.keyCode)?.keyCode : '',
    findSoundByCode: code => { const slot = slots.find(slot => slot.keyCode === code); return slot ? getSounds().find(sound => sound.id === slot.soundId) : null; }
  };
};
