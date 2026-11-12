/**
 * Bakery Calculator - Theme Module (v2.2.1-b4k3r5)
 * Seamless tri-state theme sync: auto, light, dark using modern color-scheme & light-dark().
 */

import { getPreference, setPreference } from './db.b4k3r5.js';

let currentMode = 'auto';
const systemDarkMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

function handleSystemThemeChange(e) {
  if (currentMode === 'auto') {
    applyTheme('auto', false);
  }
}

export function applyTheme(mode = 'auto', savePref = true) {
  currentMode = mode;
  const root = document.documentElement;

  if (mode === 'light') {
    root.style.colorScheme = 'light';
  } else if (mode === 'dark') {
    root.style.colorScheme = 'dark';
  } else {
    // auto: let browser follow system color-scheme
    root.style.colorScheme = 'light dark';
  }

  // Update theme-color meta tag
  const isDark = (mode === 'dark') || (mode === 'auto' && systemDarkMediaQuery.matches);
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', isDark ? '#1A120E' : '#FDF8F3');
  }

  // Sync theme radio buttons if present in DOM
  const radio = document.querySelector(`input[name="theme-choice"][value="${mode}"]`);
  if (radio) {
    radio.checked = true;
  }

  // Dispatch custom event for UI updates
  window.dispatchEvent(new CustomEvent('themechanged', { detail: { mode, isDark } }));

  if (savePref) {
    setPreference('theme_preference', mode).catch(() => {});
    try {
      localStorage.setItem('bakery_theme', mode);
    } catch (_) {}
  }
}

export async function initTheme() {
  // Try localStorage first for instant flash-free render, then DB
  let saved = null;
  try {
    saved = localStorage.getItem('bakery_theme');
  } catch (_) {}

  if (!saved) {
    saved = await getPreference('theme_preference', 'auto');
  }

  applyTheme(saved || 'auto', false);

  // Listen to OS system theme changes
  if (systemDarkMediaQuery.addEventListener) {
    systemDarkMediaQuery.addEventListener('change', handleSystemThemeChange);
  } else if (systemDarkMediaQuery.addListener) {
    systemDarkMediaQuery.addListener(handleSystemThemeChange);
  }
}

export function getCurrentThemeMode() {
  return currentMode;
}
