import fexios from './index';
import type { Fexios } from './index';

export * from './index'

// Set global fexios instance for browser
declare global {
	interface Window {
		fexios: Fexios;
	}
	// biome-ignore lint/suspicious/noRedeclare:
	const fexios: Fexios;
}
if (typeof globalThis !== 'undefined') {
	(globalThis as any).fexios = fexios;
} else if (typeof window !== 'undefined') {
	window.fexios = fexios;
}
