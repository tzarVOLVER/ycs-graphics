// Zoom the read-only viewer; the embedded broadcast canvas stays 1920 x 1080.
for (const container of document.querySelectorAll('.output')) {
  const frame = container.querySelector('iframe');
  new ResizeObserver(() => {
    const scale = container.clientWidth / 1920;
    container.style.height = `${200 * scale}px`;
    frame.style.transform = `scale(${scale}) translateY(-880px)`;
  }).observe(container);
}
