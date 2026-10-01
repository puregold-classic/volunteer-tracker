export type Viewport = { width: number; height: number };
export type ImageViewport = { scale: number; x: number; y: number };
export function fitImage(image: Viewport, viewport: Viewport): ImageViewport {
  const scale = Math.min((viewport.width - 24) / image.width, (viewport.height - 24) / image.height, 1);
  return constrainView({ scale: Math.max(0.001, scale), x: 0, y: 0 }, image, viewport);
}
export function constrainView(view: ImageViewport, image: Viewport, viewport: Viewport): ImageViewport {
  const axis = (offset: number, size: number, available: number) => size <= available ? (available - size) / 2 : Math.max(available - size, Math.min(0, offset));
  return { ...view, x: axis(view.x, image.width * view.scale, viewport.width), y: axis(view.y, image.height * view.scale, viewport.height) };
}
export function zoomImage(view: ImageViewport, scale: number, anchor: { x: number; y: number }, image: Viewport, viewport: Viewport): ImageViewport {
  const nextScale = Math.min(8, Math.max(Math.min(fitImage(image, viewport).scale, 0.1), scale));
  const factor = nextScale / view.scale;
  return constrainView({ scale: nextScale, x: anchor.x - (anchor.x - view.x) * factor, y: anchor.y - (anchor.y - view.y) * factor }, image, viewport);
}
