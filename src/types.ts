import type { Awaitable } from 'cosmokit';
import type { Fexios } from '.';
import type { FexiosResponse } from './response';

export interface FexiosConfigs {
	baseURL: string;
	timeout: number;
	query: Record<string, string | number | boolean> | URLSearchParams;
	headers: Record<string, string> | Headers;
	credentials?: RequestInit['credentials'];
	cache?: RequestInit['cache'];
	mode?: RequestInit['mode'];
	responseType?: 'json' | 'blob' | 'text' | 'stream';
}
export interface FexiosRequestOptions extends FexiosConfigs {
	url?: string | URL;
	method?: FexiosMethods;
	body?: Record<string, any> | string | FormData | URLSearchParams;
	abortController?: AbortController;
	onProgress?: (
		progress: number,
		chunk?: Uint8Array,
		buffer?: Uint8Array,
	) => void;
}
export interface FexiosContext<T = any> extends FexiosRequestOptions {
	url: string;
	rawRequest?: Request;
	rawResponse?: Response;
	response?: FexiosResponse;
	data?: T;
}
export type FexiosFinalContext<T = any> = Omit<
	FexiosContext<T>,
	'rawResponse' | 'response' | 'data' | 'headers'
> & {
	rawResponse: Response;
	response: FexiosResponse<T>;
	headers: Headers;
	data: T;
};
export type FexiosHook<C = unknown> = (context: C) => Awaitable<C | false>;
export interface FexiosHookStore {
	event: FexiosLifecycleEvents;
	action: FexiosHook;
}
export type FexiosLifecycleEvents =
	| 'beforeInit'
	| 'beforeRequest'
	| 'afterBodyTransformed'
	| 'beforeActualFetch'
	| 'afterResponse';
export interface FexiosHooksNameMap {
	beforeInit: FexiosContext;
	beforeRequest: FexiosContext;
	afterBodyTransformed: FexiosContext;
	beforeActualFetch: FexiosContext;
	afterResponse: FexiosFinalContext;
}
export interface FexiosInterceptor {
	handlers: () => FexiosHook[];
	use: <C = FexiosContext>(hook: FexiosHook<C>, prepend?: boolean) => Fexios;
	clear: () => void;
}
export interface FexiosInterceptors {
	request: FexiosInterceptor;
	response: FexiosInterceptor;
}

type LowerAndUppercase<T extends string> = Lowercase<T> | Uppercase<T>;
export type FexiosMethods = LowerAndUppercase<
	'get' | 'post' | 'put' | 'patch' | 'delete' | 'head' | 'options' | 'trace'
>;

type MethodsWithoutBody = LowerAndUppercase<
	'get' | 'head' | 'options' | 'trace'
>;
export type FexiosRequestShortcut<M extends FexiosMethods> =
	M extends MethodsWithoutBody ? ShortcutWithoutBody : ShortcutWithBody;
type ShortcutWithoutBody = <T = any>(
	url: string | URL,
	options?: Partial<FexiosRequestOptions>,
) => Promise<FexiosFinalContext<T>>;
type ShortcutWithBody = <T = any>(
	url: string | URL,
	body?: Record<string, any> | string | URLSearchParams | FormData | null,
	options?: Partial<FexiosRequestOptions>,
) => Promise<FexiosFinalContext<T>>;
