# Design

## Approach
- Extend `InputManager` to expose a readonly touch pad visual state.
- Render the virtual pad in `Renderer` so it scales with the canvas and stays inside the game visual layer.
- Pass input state from `GameLoop` into `Renderer.render`.
- Add small canvas-level polish for HUD frame, playfield vignette, and touch feedback.
- Replace the old mobile D-pad absence E2E check with a touch-location virtual pad visibility check.

## Notes
- Keep the implementation dependency-free and Canvas-based.
- Do not introduce external URLs, network calls, or fixed endpoint configuration.
- Keep the DOM free of fixed D-pad buttons; the pad is drawn only while touch is active.

