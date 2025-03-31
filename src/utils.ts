import type { FexiosResponse } from '.';
import { FexiosResponseError } from './error';

const withResolvers =
	typeof Promise.withResolvers === 'undefined'
		? function withResolvers<T>() {
				/* v8 ignore next 10 */
				// withResolvers polyfill
				let resolve: (value: T) => void;
				let reject: (reason?: unknown) => void;
				const promise = new Promise<T>((res, rej) => {
					resolve = res;
					reject = rej;
				});
				return { promise, resolve: resolve!, reject: reject! };
			}
		: <T>() => Promise.withResolvers<T>();

export function checkThrow<T>(res: FexiosResponse<T>) {
	if (!res.ok)
		throw new FexiosResponseError(
			`Request failed with status code ${res.status}`,
			res as any,
		);
	return res;
}

export function concat(buffers: Uint8Array[]): Uint8Array {
	let length = 0;
	for (const buffer of buffers) {
		length += buffer.length;
	}
	const output = new Uint8Array(length);
	let offset = 0;
	for (const buffer of buffers) {
		output.set(buffer, offset);
		offset += buffer.length;
	}

	return output;
}

export async function readToUint8ArrayUnsized(
	stream: ReadableStream<Uint8Array>,
	progressHook?: (progress: number, chunk?: Uint8Array) => void,
): Promise<Uint8Array> {
	let progress = 0;
	const buffers: Uint8Array[] = [];
	for await (const chunk of stream) {
		buffers.push(chunk);
		progress += chunk.length;
		progressHook?.(chunk.length, chunk);
	}

	return concat(buffers);
}

export async function readToUint8Array(
	stream: ReadableStream<Uint8Array>,
	size?: number,
	progressHook?: (
		progress: number,
		chunk?: Uint8Array,
		buffer?: Uint8Array,
	) => void,
): Promise<Uint8Array> {
	if (!size) return readToUint8ArrayUnsized(stream, progressHook);
	const buffer = new Uint8Array(size || 0);
	let offset = 0;

	let overflower:
		| Promise<[Promise<Uint8Array>, ReadableStreamDefaultController]>
		| undefined;
	for await (const chunk of stream) {
		if (overflower) {
			const [_, controller] = await overflower;
			controller.enqueue(chunk);
			offset += chunk.length;
			progressHook?.(offset, chunk);
			continue;
		}
		if (offset + chunk.length > buffer.length) {
			// overflow fallback
			console.warn(
				`readToUint8Array overflowed (${buffer.length}++${offset + chunk.length - buffer.length}), fallback to concat`,
			);
			const { promise, resolve } =
				withResolvers<[Promise<Uint8Array>, ReadableStreamDefaultController]>();
			overflower = promise;
			const {
				promise: bufferPromise,
				resolve: bufferResolve,
				reject: bufferReject,
			} = withResolvers<Uint8Array>();
			readToUint8ArrayUnsized(
				new ReadableStream({
					start(controller) {
						controller.enqueue(buffer.subarray(0, offset));
						controller.enqueue(chunk);
						offset += chunk.length;
						resolve([bufferPromise, controller]);
					},
				}),
			)
				.then(bufferResolve)
				.catch(bufferReject);
			continue;
		}
		buffer.set(chunk, offset);
		progressHook?.(offset, chunk, buffer);
		offset += chunk.length;
	}
	if (overflower) {
		const [bufferPromise, controller] = await overflower;
		controller.close();
		const buffer = await bufferPromise;
		progressHook?.(offset, void 0, buffer);
		return buffer;
	}

	return buffer;
}

const textTypes = new Set([
	'image/svg',
	'application/xml',
	'application/xhtml',
	'application/html',
]);

const JSON_RE = /^application\/(?:[\w!#$%&*.^`~-]*\+)?json(;.+)?$/i;

// https://github.com/unjs/ofetch/blob/c817be86e8758ed7e6a05d2589f4b318f1f0b38e/src/utils.ts#L50
// This provides reasonable defaults for the correct parser based on Content-Type header.
export function detectResponseType(
	_contentType = '',
): 'json' | 'text' | 'blob' | 'stream' {
	if (!_contentType) {
		return 'json';
	}

	// Value might look like: `application/json; charset=utf-8`
	const contentType = _contentType.split(';').shift() || '';

	if (JSON_RE.test(contentType)) {
		return 'json';
	}

	if (contentType === 'application/octet-stream') {
		return 'stream';
	}

	if (textTypes.has(contentType) || contentType.startsWith('text/')) {
		return 'text';
	}

	return 'blob';
}
