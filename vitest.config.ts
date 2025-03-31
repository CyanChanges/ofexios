import { defineConfig } from 'vitest/config';

export default defineConfig({
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
