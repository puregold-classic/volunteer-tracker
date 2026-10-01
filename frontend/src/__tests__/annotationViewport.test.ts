import { describe, expect, it } from 'vitest';
import { constrainView, fitImage, zoomImage } from '@/components/Forum/annotationViewport';

describe('annotation viewport', () => {
  const image = { width: 800, height: 3200 }, viewport = { width: 600, height: 400 };
  it('fits the entire long screenshot without stretching or upscaling small images', () => {
    const fit = fitImage(image, viewport);
    expect(image.height * fit.scale).toBe(376);
    expect(fit.x * 2 + image.width * fit.scale).toBe(viewport.width);
    expect(fit.y).toBe(12);
    expect(fitImage({ width: 80, height: 60 }, viewport)).toEqual({ scale: 1, x: 260, y: 170 });
  });
  it('keeps the image detail under the pointer while zooming after a pan', () => {
    const before = { scale: 1, x: -100, y: -800 }, anchor = { x: 250, y: 220 };
    const zoomed = zoomImage(before, 2, anchor, image, viewport);
    expect((anchor.x - zoomed.x) / zoomed.scale).toBe((anchor.x - before.x) / before.scale);
    expect((anchor.y - zoomed.y) / zoomed.scale).toBe((anchor.y - before.y) / before.scale);
  });
  it('keeps a dragged image reachable and caps extreme wheel input', () => {
    expect(constrainView({ scale: 1, x: 2000, y: -10000 }, image, viewport)).toEqual({ scale: 1, x: 0, y: -2800 });
    const fit = fitImage(image, viewport);
    const result = zoomImage(fit, 10000, { x: 300, y: 200 }, image, viewport);
    expect(result.scale).toBe(8);
    const small = zoomImage(result, 0, { x: 300, y: 200 }, image, viewport);
    expect(small.scale).toBeGreaterThan(0);
    expect(small.x).toBeGreaterThanOrEqual(0);
    expect(small.y).toBeGreaterThanOrEqual(0);
  });
});
