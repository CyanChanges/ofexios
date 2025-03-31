import { defineBuildConfig } from 'unbuild';

const PROD = process.env.NODE_ENV === 'production';

export default defineBuildConfig({
	// If entries is not provided, will be automatically inferred from package.json
	entries: [
		'./src/index',
		'./src/browser',
		{
			builder: 'mkdist',
			format: 'cjs',
			input: './src',
			outDir: './dist',
		},
	],

	rollup: {
		esbuild: {
			drop: PROD ? ['console'] : undefined,
			minify: true,
		},
	},

	// Generates .d.ts declaration file
	declaration: true,
	// Generate source maps
	sourcemap: true,
});
