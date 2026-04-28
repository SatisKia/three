export function setAnimationLoop(renderer, frameInterval, frameFunc) {
  let accumulation = 0;
  let lastTick = performance.now();
  const getInterval = typeof frameInterval === "function" ? frameInterval : () => frameInterval;
  renderer.setAnimationLoop(() => {
    const now = performance.now();
    const interval = getInterval();
    accumulation += now - lastTick;
    lastTick = now;
    if (accumulation < interval) return;
    accumulation -= interval;
    if (accumulation > interval) accumulation = 0;
    frameFunc(now);
  });
}
