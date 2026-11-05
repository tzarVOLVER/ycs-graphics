// Layout widths ignore transforms on both the label and its ancestors.
// Keep short labels at their designed size; reserve one pixel for rounding.
export function fitHorizontal(text, availableWidth) {
  const naturalWidth = Math.max(text.scrollWidth, text.offsetWidth);
  if (!(availableWidth > 0) || !(naturalWidth > 0)) return null;
  const scale = Math.min(1, Math.max(0, availableWidth - 1) / naturalWidth);
  text.style.transform = `scaleX(${scale})`;
  return scale;
}
