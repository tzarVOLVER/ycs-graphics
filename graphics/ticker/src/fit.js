// Layout widths ignore CSS transforms on both the label and its ancestors.
// Reserve one pixel for integer rounding and glyph-edge antialiasing.
export function fitHorizontal(text, availableWidth) {
  const naturalWidth = Math.max(text.scrollWidth, text.offsetWidth);
  if (!(availableWidth > 0) || !(naturalWidth > 0)) return null;
  const scale = Math.min(1, Math.max(0, availableWidth - 1) / naturalWidth);
  text.style.transform = `scaleX(${scale})`;
  return scale;
}
