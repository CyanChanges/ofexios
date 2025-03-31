import { defineConfig } from 'vitest/config';
import { polyfill } from './build.config';

export default defineConfig({
	plugins: [polyfill()],
	test: {
		coverage: {
			enabled: true,
			include: ['src/**'],
			reportsDirectory: './.test_reports/coverage',
		},
		reporters: ['default', 'html'],
		outputFile: {
			html: './.test_reports/index.html',
		},
		testTimeout: 10 * 1000,
	},
});
