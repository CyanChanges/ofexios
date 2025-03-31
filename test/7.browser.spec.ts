import { describe, expect, it } from 'vitest';
import type {} from '../src/browser';

describe('Browser', async () => {
	const exports = await import('../src/browser');
	it('Exports Equality', async () => {
		expect(exports).to.deep.equal(await import('../src/index'));
	});
	it('Expose Global', () => {
		if (typeof globalThis !== 'undefined')
			expect(Reflect.get(globalThis, 'fexios')).to.equal(exports.default);
		if (typeof window !== 'undefined')
			expect(window.fexios).to.equal(exports.default);
	});
});
