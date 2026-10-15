// Packaged TV applications have no browser chrome and need explicit D-pad focus.
export function installTizenRemote() {
  let directorActive = false;
  document.addEventListener('bos42:director-state', event => {directorActive = !!(event as CustomEvent<boolean>).detail;});
  let mapControls = false;
  let rotateControls = false;
  const tvInput = (window as unknown as {tizen?: {tvinputdevice?: {registerKey(name: string): void}}}).tizen?.tvinputdevice;
  for (const key of ['MediaRewind', 'MediaFastForward', 'ChannelUp', 'ChannelDown']) {
    try { tvInput?.registerKey(key); } catch { /* Optional keys vary by remote. */ }
  }
  document.addEventListener('bos42:map-controls', event => {
    const controls = (event as CustomEvent<{active:boolean;rotate:boolean}>).detail;
    mapControls = controls.active;
    rotateControls = controls.rotate;
  });
  document.addEventListener('keydown', event => {
    if (mapControls) {
      const arrows = rotateControls ? {37:'rotate-left',38:'tilt-up',39:'rotate-right',40:'tilt-down'} : {37:'pan-left',38:'pan-up',39:'pan-right',40:'pan-down'};
      const command = ({...arrows,412:'rotate-left',417:'rotate-right',427:'zoom-in',428:'zoom-out'} as Record<number,string>)[event.keyCode];
      if (event.keyCode === 10009 || event.key === 'Enter') {
        event.preventDefault(); event.stopImmediatePropagation();
        document.dispatchEvent(new CustomEvent('bos42:map-controls-exit'));
      } else if (command) {
        event.preventDefault(); event.stopImmediatePropagation();
        document.dispatchEvent(new CustomEvent('bos42:map-command', {detail:command}));
      }
      return;
    }
    if (event.keyCode === 10009) {
      event.preventDefault();
      const active = document.activeElement;
      if (active instanceof HTMLInputElement && active.dataset.tvEditing) {
        active.blur();
        document.querySelector<HTMLElement>('.traffic-board .board-row, .traffic-board .board-return')?.focus();
        return;
      }
      const nativeDialog = document.querySelector('dialog[open]');
      if (nativeDialog) { nativeDialog.dispatchEvent(new Event('cancel', {cancelable:true})); return; }
      const overlay = document.querySelector('[role="dialog"], .traffic-drawer') || active?.closest('#atc-radio');
      if (overlay) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      else if (directorActive) document.dispatchEvent(new CustomEvent('bos42:director-stop'));
      else {
        const tv = (window as unknown as {tizen?: {application: {getCurrentApplication(): {hide(): void}}}}).tizen;
        tv?.application.getCurrentApplication().hide();
      }
      return;
    }
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    const active = document.activeElement;
    if (active instanceof HTMLInputElement && active.dataset.tvEditing || active instanceof HTMLTextAreaElement || (active?.closest('.atc-tune-knob') && ['ArrowLeft','ArrowRight'].includes(event.key))) return;
    const board = active?.closest('.traffic-board');
    if (board && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      const rows = [...board.querySelectorAll<HTMLElement>('.board-row')];
      const index = rows.indexOf(active as HTMLElement);
      const search = board.querySelector<HTMLElement>('.board-search input');
      let target: HTMLElement | undefined | null;
      if (index >= 0) target = event.key === 'ArrowDown' ? rows[index + 1] : rows[index - 1] || search;
      else if (active === search) target = event.key === 'ArrowDown' ? rows[0] : board.querySelector<HTMLElement>('.board-tabs button[aria-pressed="true"]');
      else if (event.key === 'ArrowDown') target = rows[0];
      if (target) {event.preventDefault();target.focus({preventScroll:true});target.scrollIntoView({block:'nearest',inline:'nearest'});return;}
      if (index >= 0 && event.key === 'ArrowDown') {event.preventDefault();return;}
    }
    if (active instanceof HTMLInputElement && !['ArrowUp','ArrowDown'].includes(event.key)) return;
    const dialog = document.querySelector('dialog[open], [role="dialog"]');
    const root = dialog || document;
    const items = [...root.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), a[href], summary, [role="button"][tabindex]:not([tabindex="-1"])')]
      .filter(item => { const box = item.getBoundingClientRect(); return box.width > 0 && box.height > 0 && box.bottom > 0 && box.top < innerHeight; });
    if (!items.length) return;
    event.preventDefault();
    if (!(active instanceof HTMLElement) || !items.includes(active)) { items[0].focus(); return; }
    const box = active.getBoundingClientRect(), x = box.x + box.width / 2, y = box.y + box.height / 2;
    const horizontal = event.key === 'ArrowLeft' || event.key === 'ArrowRight';
    const direction = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
    const candidates = items.filter(item => item !== active).map(item => {
      const r = item.getBoundingClientRect(), dx = r.x + r.width / 2 - x, dy = r.y + r.height / 2 - y;
      const forward = (horizontal ? dx : dy) * direction;
      return { item, forward, score: forward + Math.abs(horizontal ? dy : dx) * 3 };
    }).filter(item => item.forward > 1).sort((a, b) => a.score - b.score);
    candidates[0]?.item.focus();
    candidates[0]?.item.scrollIntoView({block:'nearest',inline:'nearest'});
  }, true);
}
