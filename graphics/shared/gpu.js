// Whether the page is being drawn with GPU acceleration. vMix's browser (Chromium 115) can run either
// way. With GPU off it draws in software, and Chromium then refuses a WebGL context when asked for one
// that isn't software-only (failIfMajorPerformanceCaveat). Asked once per page; the test context is
// released straight away.
let cached;
export function gpuCompositing(doc = globalThis.document) {
  if (cached !== undefined) return cached;
  try {
    const canvas = doc.createElement('canvas');
    const gl = canvas.getContext('webgl', { failIfMajorPerformanceCaveat: true });
    cached = Boolean(gl);
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    cached = false;
  }
  return cached;
}
