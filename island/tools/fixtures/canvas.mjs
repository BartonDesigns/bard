// Canvas API fixture for geometry/resource tests, not a pixel renderer. These tests
// exercise streaming and disposal; visual fidelity still needs a browser playtest.
import assert from 'node:assert/strict';

export function mockTextureCanvas(t) {
	const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
	t.after(() => {
		if (original) Object.defineProperty(globalThis, 'document', original);
		else delete globalThis.document;
	});
	globalThis.document = {
		createElement(tag) {
			assert.equal(tag, 'canvas');
			const canvas = { width: 300, height: 150 };
			const context = { canvas };
			for (const method of ['arc', 'beginPath', 'bezierCurveTo', 'clip', 'closePath', 'drawImage', 'ellipse', 'fill', 'fillRect', 'lineTo', 'moveTo', 'quadraticCurveTo', 'restore', 'rotate', 'save', 'stroke', 'translate']) context[method] = () => {};
			for (const method of ['createLinearGradient', 'createRadialGradient']) context[method] = () => ({ addColorStop() {} });
			canvas.getContext = (kind) => { assert.equal(kind, '2d'); return context; };
			return canvas;
		},
	};
}
