import swc from '@rollup/plugin-swc';
import virtual from '@rollup/plugin-virtual';
import { defineBuildConfig } from 'unbuild';

const PROD = process.env.NODE_ENV === 'production';

export function polyfill() {
	return virtual({
		'#ofexios/stream-polyfill': `
					const polys = ((global) => {
					  var require = typeof require === 'undefined' ? import.meta.require : require;
      let _a = global?.ReadableStream
      let _b = global?.TransformStream
      if (typeof require !== "undefined") {
        try {
          const require_stream_web = require('stream/web')
          if (!_a) _a = require_stream_web.ReadableStream
          if (!_b) _b = require_stream_web.TransformStream
        } catch {
          try {
            const require_polyfill = require("web-streams-polyfill")
            if (!_a) _a = require_polyfill.ReadableStream
            if (!_b) _b = require_polyfill.TransformStream
         	} catch {
              throw new TypeError("stream polyfill is not available")
         	}
        }
      }
      return { ReadableStream: _a, TransformStream: _b }
    })((void 0, ()=>this)());
    export const ReadableStream = polys.ReadableStream;
    export const TransformStream = polys.TransformStream;
    export default polys
					`,
	});
}

export default defineBuildConfig({
	// If entries is not provided, will be automatically inferred from package.json
	entries: ['./src/index', './src/browser'],

	rollup: {
		esbuild: {
			drop: PROD ? ['console'] : undefined,
			minify: true,
		},
		emitCJS: true,
		inlineDependencies: ['#ofexios/stream-polyfill'],
		output: {
			exports: 'named',
		},
	},
	hooks: {
		'rollup:options'(ctx, options) {
			options.moduleContext = (id) => {
				if (id.startsWith('\x00virtual:#ofexios/stream-polyfill'))
					return 'this';
				return null;
			};
			options.plugins.push(polyfill(), swc());
		},
	},

	// Generates .d.ts declaration file
	declaration: true,
	// Generate source maps
	sourcemap: true,
});
