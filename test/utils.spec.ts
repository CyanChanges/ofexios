import { describe, expect, it } from 'vitest';
import { readToUint8Array, readToUint8ArrayUnsized } from '../src/utils';

describe('Test utils.ts', () => {
	it('readToUint8ArrayUnsized', async () => {
		const blob = new Blob(['hello', 'world']);
		const array = await readToUint8ArrayUnsized(blob.stream());
		expect(array).to.deep.equal(await blob.bytes());
	});

	it('readToUint8Array (without size)', async () => {
		const blob = new Blob(['hello', 'world']);
		const array = await readToUint8Array(blob.stream());
		expect(array).to.deep.equal(await blob.bytes());
	});

	it('readToUint8Array (with exact size)', async () => {
		const blob = new Blob(['hello', 'world']);
		const array = await readToUint8Array(blob.stream(), blob.size);
		expect(array).to.deep.equal(await blob.bytes());
	});

	it('readToUint8Array (with smaller size)', async () => {
		const blob = new Blob(['hello', 'world']);
		const array = await readToUint8Array(blob.stream(), blob.size - 5);
		expect(array).to.deep.equal(await blob.bytes());
	});
});
