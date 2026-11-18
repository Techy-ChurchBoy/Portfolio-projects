import './styles.css';
import { initUI, $ } from './ui.js';

initUI();

// Lite mode: plain page with no 3D, for weak devices or when WebGL is missing.
const LITE_KEY = 'sw-lite';
const store = {
  get(k) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* ignore */
    }
  },
};

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

const lite = new URLSearchParams(location.search).has('lite') || store.get(LITE_KEY) === '1' || !hasWebGL();
const toggle = $('#tLite');
toggle.addEventListener('click', () => {
  store.set(LITE_KEY, lite ? '0' : '1');
  location.reload();
});

const hideLoader = () => $('#loader').classList.add('done');
const fallBack = (err) => {
  console.error(err);
  document.body.classList.add('lite');
  hideLoader();
};

if (lite) {
  document.body.classList.add('lite');
  toggle.textContent = '3D';
  toggle.setAttribute('aria-pressed', 'true');
  hideLoader();
} else {
  // three.js and the scene load as a separate chunk so the page text appears first.
  import('./scene3d.js')
    .then((m) => m.startScene())
    .then(() => setTimeout(hideLoader, 500))
    .catch((err) => {
      store.set(LITE_KEY, '1');
      fallBack(err);
    });
}

addEventListener(
  'scroll',
  () => {
    $('#hint').style.opacity = scrollY > 80 ? 0 : 1;
  },
  { passive: true },
);
