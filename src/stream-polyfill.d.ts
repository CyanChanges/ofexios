declare module '#ofexios/stream-polyfill' {
	interface Streams {
		ReadableStream: typeof global.ReadableStream;
		TransformStream: typeof global.TransformStream;
	}
	export default Streams;
	export const ReadableStream: typeof global.ReadableStream;
	export const TransformStream: typeof global.TransformStream;
}
