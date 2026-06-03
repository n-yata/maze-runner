import { MapManager } from './map.js';
import { PlayerManager } from './player.js';
import { GhostManager } from './ghost.js';
import { FruitManager } from './fruit.js';
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

// 縦長キャンバスをビューポート内にアスペクト比維持でフィットさせる。
// 盤面外に残る余白は背後の全画面星空キャンバスが埋める。
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
  const bgCanvas = document.getElementById('bgCanvas') as HTMLCanvasElement | null;

  const map = new MapManager();
  const player = new PlayerManager();
  const ghostMgr = new GhostManager();
  const fruitMgr = new FruitManager();
  const renderer = new Renderer(canvas, bgCanvas ?? undefined);
  const inputMgr = new InputManager();
  const audio = new AudioManager();
  const storage = new StorageManager();

  const fit = (): void => {
    fitToViewport(canvas);
    renderer.resizeBackground(window.innerWidth, window.innerHeight);
  };
  fit();
  window.addEventListener('resize', fit);

  const loop = new GameLoop(map, player, ghostMgr, renderer, inputMgr, audio, storage, fruitMgr);
  loop.start();
});
