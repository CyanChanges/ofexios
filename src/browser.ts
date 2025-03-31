import fexios from './index';
import type { Fexios } from './index';

export * from './index';
export { default } from './index';

// Set global fexios instance for browser
declare global {
	interface globalThis {
		fexios: Fexios;
	}
	interface Window {
		fexios: Fexios;
	}
	// biome-ignore lint/suspicious/noRedeclare:
	var fexios: Fexios;
}
if (typeof globalThis !== 'undefined') {
	globalThis.fexios = fexios;
	/* v8 ignore next 3 */
} else if (typeof window !== 'undefined') {
	window.fexios = fexios;
}
