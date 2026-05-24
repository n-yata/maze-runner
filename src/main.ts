import { MapManager } from './map.js';
import { PlayerManager } from './player.js';
import { GhostManager } from './ghost.js';
import { Renderer } from './renderer.js';
import { InputManager } from './input.js';
import { AudioManager } from './audio.js';
import { StorageManager } from './storage.js';
import { GameLoop } from './gameLoop.js';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js');
  });
}

function fitToViewport(canvas: HTMLCanvasElement): void {
  const scaleX = window.innerWidth / canvas.width;
  const scaleY = window.innerHeight / canvas.height;
  const scale = Math.min(scaleX, scaleY);
  canvas.style.width = `${Math.round(canvas.width * scale)}px`;
  canvas.style.height = `${Math.round(canvas.height * scale)}px`;
}

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement | null;
  if (!canvas) throw new Error('Canvas element not found');

  const map = new MapManager();
  const player = new PlayerManager();
  const ghostMgr = new GhostManager();
  const renderer = new Renderer(canvas);
  const inputMgr = new InputManager();
  const audio = new AudioManager();
  const storage = new StorageManager();

  fitToViewport(canvas);
  window.addEventListener('resize', () => fitToViewport(canvas));

  const loop = new GameLoop(map, player, ghostMgr, renderer, inputMgr, audio, storage);
  loop.start();
});
