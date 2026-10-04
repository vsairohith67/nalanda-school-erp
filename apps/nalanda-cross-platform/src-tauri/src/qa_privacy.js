// QA artifact only. Tauri installs this main-frame script at document creation,
// before frontend scripts. It observes; it never alters or masks application DOM.
(() => {
  if (location.origin !== 'http://tauri.localhost' && location.origin !== 'https://tauri.localhost' && location.protocol !== 'tauri:') return;
  const early = document.readyState === 'loading' && !document.querySelector('.app-frame,.lock-screen');
  let armed = true, failed = !early, samples = 0, transitions = 0, unlockPermitted = false, unlockClicked = false;
  const check = () => {
    samples++;
    const locked = document.querySelector('.lock-screen'), workspace = document.querySelector('.app-frame');
    if (unlockClicked && !locked && workspace) { armed = false; unlockClicked = false; unlockPermitted = false; }
    const text = (document.body?.textContent || '') + Array.from(document.querySelectorAll('input,textarea,[value],[title],[aria-label]')).map(node => [node.value || '',node.getAttribute('value') || '',node.getAttribute('title') || '',node.getAttribute('aria-label') || ''].join(' ')).join(' ');
    const privateCanary = /synthetic-wsp-[a-f0-9]{24}-(one|two)|SYNTHETIC Windows (one|two)/.test(text);
    if (armed && document.visibilityState !== 'hidden' && (workspace || privateCanary)) failed = true;
  };
  const observer = new MutationObserver(check);
  observer.observe(document, {subtree:true,childList:true,characterData:true,attributes:true});
  document.addEventListener('visibilitychange', () => { if (document.hidden) { armed = true; unlockPermitted = false; unlockClicked = false; transitions++; } else check(); }, true);
  document.addEventListener('click', event => {
    const button = event.target.closest?.('button');const label = button?.textContent?.trim();
    if (label === 'Unlock app' && unlockPermitted) unlockClicked = true;
    if (label === 'Lock' || label === 'Lock app') { armed = true; unlockPermitted = false; unlockClicked = false; }
  }, true);
  const frame = () => { check(); requestAnimationFrame(frame); };requestAnimationFrame(frame);
  // Configuration is restricted to observation. No vault/IPC/network/DOM write.
  Object.defineProperty(window, '__nalandaEarlyPrivacy', {value:Object.freeze({
    read: () => ({contract:'NALANDA_EARLY_DOM_OBSERVATION_V1',early,failed,samples,transitions,armed,boundary:'DOCUMENT_CREATION_DOM_AND_RAF_NOT_COMPOSITOR_FRAMES'}),
    expectLocked: () => { /* The actual click/visibility event arms observation. */ },
    allowUnlock: () => { check(); unlockPermitted=true; }
  }),writable:false,configurable:false});
})();
