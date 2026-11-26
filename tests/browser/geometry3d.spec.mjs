// Browser verification for the WebGL2 3D Geometry Studio, Canvas2D fallback,
// 3D card perspective tilt + specular highlight, keyboard/pointer orbit, and reduced-motion pause.
import { test, expect, settle } from './fixtures.mjs';

async function canvasSignature(page) {
  return page.evaluate(() => {
    const src = document.getElementById('geometry-canvas');
    if (!src || !src.width || !src.height) return null;
    const probe = document.createElement('canvas');
    probe.width = 48;
    probe.height = 30;
    const ctx = probe.getContext('2d');
    ctx.drawImage(src, 0, 0, probe.width, probe.height);
    const { data } = ctx.getImageData(0, 0, probe.width, probe.height);
    let nonDark = 0;
    let checksum = 0;
    const distinct = new Set();
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a > 0 && (r > 36 || g > 48 || b > 72)) nonDark++;
      checksum = (checksum * 31 + r + g * 3 + b * 7 + a) >>> 0;
      distinct.add(`${r >> 4},${g >> 4},${b >> 4}`);
    }
    return { nonDark, checksum, distinctCount: distinct.size };
  });
}

async function studioState(page) {
  return page.evaluate(() => document.getElementById('geometry-studio')?.__geometryStudio?.getState() || null);
}

test.describe('3D Geometry Studio & Motion Choreography', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('renders 3D studio, switches modes/presets, handles drag/keyboard/pause, and tilts domain cards', async ({
    page,
  }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (
        msg.type() === 'error' &&
        !/ERR_BLOCKED_BY_CLIENT|NS_ERROR_|NetworkError|raw\.githubusercontent\.com|blocked by Playwright|Service Worker/i.test(
          text,
        )
      ) {
        consoleErrors.push(text);
      }
    });

    await page.goto('/');
    await page.clock.resume();
    await settle(page);

    const studio = page.locator('#geometry-studio');
    await studio.scrollIntoViewIfNeeded();
    await settle(page);

    const viewport = page.locator('.studio-viewport-wrap');
    const renderer = await viewport.getAttribute('data-renderer');
    expect(['webgl2', 'canvas2d']).toContain(renderer);

    const canvas = page.locator('#geometry-canvas');
    const box = await canvas.boundingBox();
    expect(box.width).toBeGreaterThan(220);
    expect(box.height).toBeGreaterThan(150);

    await expect.poll(async () => (await canvasSignature(page))?.distinctCount || 0).toBeGreaterThan(4);
    const conicSig = await canvasSignature(page);
    expect(conicSig.nonDark).toBeGreaterThan(15);

    // Switch through all three SAT modes and presets
    await expect(page.locator('#studio-shape-name')).toHaveText('Ellipse');
    await page.getByRole('button', { name: 'Circle (0°)' }).click();
    await expect(page.locator('#studio-shape-name')).toHaveText('Circle');
    await expect(page.locator('#studio-metrics')).toContainText('0.000');

    await page.getByRole('button', { name: 'Parabola (60°)' }).click();
    await expect(page.locator('#studio-shape-name')).toHaveText('Parabola');
    await expect(page.locator('#studio-metrics')).toContainText('1.000');

    await page.getByRole('button', { name: 'Hyperbola (78°)' }).click();
    await expect(page.locator('#studio-shape-name')).toHaveText('Hyperbola');

    await page.getByRole('button', { name: 'Coordinate Sphere' }).click();
    await expect(page.locator('#studio-shape-name')).toHaveText('Secant Circle');
    await expect(page.locator('#studio-equation')).toContainText('(x − 0.2)²');
    const sphereSig = await canvasSignature(page);
    expect(sphereSig.checksum).not.toBe(conicSig.checksum);

    await page.getByRole('button', { name: 'Volume Solid' }).click();
    await expect(page.locator('#studio-shape-name')).toHaveText('Right Cone');
    await page.getByRole('button', { name: 'Cylinder' }).click();
    await expect(page.locator('#studio-shape-name')).toHaveText('Right Cylinder');
    await page.getByRole('button', { name: 'Prism' }).click();
    await expect(page.locator('#studio-shape-name')).toHaveText('Rectangular Prism');

    // Explicit Pause 3D toggle freezes camera orbit, Resume restarts it
    const pauseBtn = page.locator('#studio-pause');
    await expect(pauseBtn).toHaveAttribute('aria-pressed', 'false');
    await pauseBtn.click();
    await expect(pauseBtn).toHaveAttribute('aria-pressed', 'true');
    const pausedYawA = (await studioState(page)).orbit.yaw;
    await page.waitForTimeout(180);
    const pausedYawB = (await studioState(page)).orbit.yaw;
    expect(Math.abs(pausedYawB - pausedYawA)).toBeLessThan(1e-5);

    // Keyboard controls on focused canvas (Arrow keys, +, -, r, Space)
    await canvas.focus();
    await expect(canvas).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => (await studioState(page)).orbit.targetYaw).toBeGreaterThan(pausedYawA);

    const distBefore = (await studioState(page)).orbit.targetDistance;
    await page.keyboard.press('+');
    await expect.poll(async () => (await studioState(page)).orbit.targetDistance).toBeLessThan(distBefore);
    await page.keyboard.press('-');
    await expect.poll(async () => (await studioState(page)).orbit.targetDistance).toBeCloseTo(distBefore, 2);

    // Space resumes when paused, R resets camera
    await page.keyboard.press('Space');
    await expect(pauseBtn).toHaveAttribute('aria-pressed', 'false');
    await page.keyboard.press('r');
    await expect(pauseBtn).toHaveAttribute('aria-pressed', 'false');

    // Pointer drag-to-orbit on canvas
    await canvas.scrollIntoViewIfNeeded();
    const dragBox = await canvas.boundingBox();
    const preDragYaw = (await studioState(page)).orbit.targetYaw;
    await page.mouse.move(dragBox.x + dragBox.width * 0.5, dragBox.y + dragBox.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(dragBox.x + dragBox.width * 0.72, dragBox.y + dragBox.height * 0.42, { steps: 6 });
    await page.mouse.up();
    const postDragYaw = (await studioState(page)).orbit.targetYaw;
    expect(Math.abs(postDragYaw - preDragYaw)).toBeGreaterThan(0.1);

    // 3D perspective tilt + specular sheen on .domain-card (when hover is supported)
    const firstCard = page.locator('.domain-card').first();
    await firstCard.scrollIntoViewIfNeeded();
    await settle(page);
    const cardBox = await firstCard.boundingBox();
    await page.mouse.move(cardBox.x + cardBox.width * 0.15, cardBox.y + cardBox.height * 0.15);
    await expect
      .poll(async () =>
        firstCard.evaluate((node) => ({
          transform: node.style.transform,
          sheen: node.style.getPropertyValue('--sheen'),
        })),
      )
      .toEqual(
        expect.objectContaining({
          transform: expect.stringContaining('rotateX'),
          sheen: '0.85',
        }),
      );
    await page.mouse.move(0, 0);

    expect(consoleErrors).toEqual([]);
  });

  test('falls back cleanly to Canvas 2D software projection when WebGL2 is unavailable', async ({ page }) => {
    await page.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function patched(type, ...rest) {
        if (type === 'webgl2') return null;
        return orig.call(this, type, ...rest);
      };
    });

    await page.goto('/');
    await page.clock.resume();
    await settle(page);

    await page.locator('#geometry-studio').scrollIntoViewIfNeeded();
    await expect(page.locator('.studio-viewport-wrap')).toHaveAttribute('data-renderer', 'canvas2d');
    await expect(page.locator('#studio-renderer-badge')).toHaveText('Canvas 2D');

    const sig1 = await canvasSignature(page);
    expect(sig1.nonDark).toBeGreaterThan(15);
    expect(sig1.distinctCount).toBeGreaterThan(4);

    await page.getByRole('button', { name: 'Coordinate Sphere' }).click();
    await expect(page.locator('#studio-shape-name')).toHaveText('Secant Circle');
    const sig2 = await canvasSignature(page);
    expect(sig2.checksum).not.toBe(sig1.checksum);
  });
});

test.describe('3D Geometry Studio: reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('pauses continuous 3D rotation and disables card perspective tilt', async ({ page }) => {
    await page.goto('/');
    await page.clock.resume();
    await settle(page);

    const studio = page.locator('#geometry-studio');
    await studio.scrollIntoViewIfNeeded();

    const pauseBtn = page.locator('#studio-pause');
    await expect(pauseBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(pauseBtn).toHaveText('Motion paused');

    const initial = await studioState(page);
    expect(initial.orbit.reducedMotion).toBe(true);
    expect(initial.orbit.paused).toBe(true);
    expect(initial.orbit.settled).toBe(true);

    await page.waitForTimeout(220);
    const later = await studioState(page);
    expect(later.orbit.yaw).toBe(initial.orbit.yaw);
    expect(later.orbit.pitch).toBe(initial.orbit.pitch);

    // Discrete keyboard orbit still snaps synchronously without inertia loop
    await page.locator('#geometry-canvas').focus();
    await page.keyboard.press('ArrowRight');
    const afterKey = await studioState(page);
    expect(afterKey.orbit.yaw).toBeGreaterThan(initial.orbit.yaw);
    expect(afterKey.orbit.settled).toBe(true);

    // Card tilt stays inactive under reduced motion
    const firstCard = page.locator('.domain-card').first();
    const cardBox = await firstCard.boundingBox();
    await page.mouse.move(cardBox.x + cardBox.width * 0.2, cardBox.y + cardBox.height * 0.2);
    await page.waitForTimeout(80);
    expect(await firstCard.evaluate((node) => node.style.transform)).toBe('');
  });
});
