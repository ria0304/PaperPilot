import './styles.css';
import { initUi } from './ui.js';
import { render, updateWidth, ensureFont, schedule } from './render.js';

initUi();
updateWidth();
render();
ensureFont();

if (document.fonts) {
  if (document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', schedule);
  if (document.fonts.ready) document.fonts.ready.then(schedule);
}
