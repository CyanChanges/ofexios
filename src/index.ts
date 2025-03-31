import CallableInstance from "callable-instance";
import { type Awaitable, Time } from "cosmokit";
import { safeDestr } from "destr";
import { type FetchResponse, type MappedResponseType, ofetch } from "ofetch";
import { TransformStream } from "#ofexios/stream-polyfill";
import { FexiosError, FexiosErrorCodes, FexiosResponseError } from "./error";
import { FexiosResponse } from "./response";
import type {
  FexiosConfigs,
  FexiosContext,
  FexiosFinalContext,
  FexiosHook,
  FexiosHookStore,
  FexiosInterceptor,
  FexiosInterceptors,
  FexiosLifecycleEvents,
  FexiosMethods,
  FexiosRequestOptions,
  FexiosRequestShortcut,
} from "./types";
import { checkThrow, detectResponseType, readToUint8Array } from "./utils";

export { fetch } from "ofetch";

export * from "./response";
export * from "./types";
export * from "./error";

/**
 * Fexios
 * @desc Fetch based HTTP client with similar API to axios for browser and Node.js
 *
 * @license MIT
 * @author dragon-fish <dragon-fish@qq.com>
 */

export class Fexios extends CallableInstance<
  [
    string | URL | Partial<FexiosRequestOptions>,
    Partial<FexiosRequestOptions>?,
  ],
  Promise<FexiosFinalContext>
> {
  protected hooks: FexiosHookStore[] = [];
  readonly DEFAULT_CONFIGS: FexiosConfigs = {
    baseURL: "",
    timeout: Time.minute,
    credentials: "same-origin",
    headers: {},
    query: {},
    responseType: undefined,
  };
  private readonly ALL_METHODS: FexiosMethods[] = [
    "get",
    "post",
    "put",
    "patch",
    "delete",
    "head",
    "options",
    "trace",
  ];
  private readonly METHODS_WITHOUT_BODY: FexiosMethods[] = [
    "get",
    "head",
    "options",
    "trace",
  ];
  private static readonly BLOB_MIME_TYPE: string[] = [
    "image/",
    "video/",
    "audio/",
  ];

  constructor(public baseConfigs: Partial<FexiosConfigs> = {}) {
    super("request");
    this.ALL_METHODS.forEach(this.createMethodShortcut.bind(this));
  }

  async request<T = any>(
    url: string | URL,
    options?: Partial<FexiosRequestOptions>,
  ): Promise<FexiosFinalContext<T>>;
  async request<T = any>(
    options: Partial<FexiosRequestOptions> & { url: string | URL },
  ): Promise<FexiosFinalContext<T>>;
  async request<T = any>(
    urlOrOptions:
      | string
      | URL
      | (Partial<FexiosRequestOptions> & { url: string | URL }),
    options?: Partial<FexiosRequestOptions>,
  ): Promise<FexiosFinalContext<T>> {
    let ctx: FexiosContext = (options = options || {}) as any;
    if (typeof urlOrOptions === "string" || urlOrOptions instanceof URL) {
      ctx.url = urlOrOptions.toString();
    } else if (typeof urlOrOptions === "object") {
      ctx = { ...urlOrOptions, ...ctx };
    }
    ctx = await this.emit("beforeInit", ctx);

    const baseUrlString =
      options.baseURL || this.baseConfigs.baseURL || globalThis.location?.href;
    const baseURL = baseUrlString
      ? new URL(baseUrlString, globalThis.location?.href)
      : undefined;
    const reqURL = new URL(ctx.url.toString(), baseURL);
    ctx.url = reqURL.href;
    ctx.baseURL = baseURL ? baseURL.href : reqURL.origin;

    ctx.headers = this.mergeHeaders(
      this.baseConfigs.headers,
      options.headers,
    ) as any;
    ctx.query = this.mergeQuery(
      this.baseConfigs.query,
      reqURL.searchParams,
      options.query,
    );

    reqURL.search = new URLSearchParams(ctx.query as any).toString();
    ctx.url = reqURL.toString();

    if (
      this.METHODS_WITHOUT_BODY.includes(
        ctx.method?.toLocaleLowerCase() as FexiosMethods,
      ) &&
      ctx.body
    ) {
      throw new FexiosError(
        FexiosErrorCodes.BODY_NOT_ALLOWED,
        `Request method "${ctx.method}" does not allow body`,
      );
    }

    ctx = await this.emit("beforeRequest", ctx);

    let body: string | FormData | URLSearchParams | Blob | undefined;
    if (typeof ctx.body !== "undefined" && ctx.body !== null) {
      // Automatically transform JSON object to JSON string
      if (
        ctx.body instanceof Blob ||
        ctx.body instanceof FormData ||
        ctx.body instanceof URLSearchParams
      ) {
        body = ctx.body;
      } else if (typeof ctx.body === "object") {
        body = JSON.stringify(ctx.body);
        (ctx.headers as any)["content-type"] =
          "application/json; charset=UTF-8";
      } else {
        body = ctx.body;
      }
    }

    // Adjust content-type header
    if (!(options.headers as any)?.["content-type"] && body) {
      // If body is FormData or URLSearchParams, simply delete content-type header to let Request constructor handle it
      if (!(body instanceof FormData || body instanceof URLSearchParams)) {
        delete (ctx.headers as any)["content-type"];
      }
      // If body is a string and ctx.body is an object, it means ctx.body is a JSON string
      else if (typeof body === "string" && typeof ctx.body === "object") {
        /* v8 ignore next 3 */
        (ctx.headers as any)["content-type"] =
          "application/json; charset=UTF-8";
      }
      // If body is a Blob, set content-type header to the Blob's type
      else if (body instanceof Blob) {
        (ctx.headers as any)["content-type"] = body.type;
      }
    }

    ctx.body = body;
    ctx = await this.emit("afterBodyTransformed", ctx);

    const abortController =
      ctx.abortController || globalThis.AbortController
        ? new AbortController()
        : /* v8 ignore next */ undefined;
    const rawRequest = new Request(ctx.url, {
      method: ctx.method || "GET",
      credentials: ctx.credentials,
      cache: ctx.cache,
      mode: ctx.mode,
      headers: ctx.headers,
      body: ctx.body as any,
      signal: abortController?.signal,
    });
    ctx.rawRequest = rawRequest;

    ctx = await this.emit("beforeActualFetch", ctx);

    if (ctx.url.startsWith("ws")) {
      console.info("WebSocket:", ctx.url);
      const ws = new WebSocket(ctx.url);
      ctx.rawResponse = new Response();
      ctx.response = new FexiosResponse(ctx.rawResponse, ws as any, {
        ok: true,
        status: 101,
        statusText: "Switching Protocols",
      });
      ctx.data = ws;
      ctx.headers = new Headers();
      return this.emit("afterResponse", ctx) as any;
    }

    const timeout = ctx.timeout || this.baseConfigs.timeout || Time.minute;
    const timer = setTimeout(() => {
      abortController?.abort();
      if (!abortController) {
        throw new FexiosError(
          FexiosErrorCodes.TIMEOUT,
          `Request timed out after ${timeout}ms`,
          ctx,
        );
      }
    }, timeout);
    const rawResponse = await fetch(ctx.rawRequest!).catch((err: any) =>
      Promise.reject(
        new FexiosError(FexiosErrorCodes.NETWORK_ERROR, err.error.message, ctx),
      ),
    );

    ctx.rawResponse = rawResponse;
    ctx.response = await Fexios.resolveResponseBody(
      rawResponse,
      ctx.responseType,
      (progress, buffer) => {
        console.info("Download progress:", progress);
        options?.onProgress?.(progress, buffer);
      },
    ).finally(() => {
      clearTimeout(timer);
    });
    ctx.data = ctx.response.data;
    ctx.headers = ctx.response.headers;

    return this.emit("afterResponse", ctx) as any;
  }

  mergeQuery(
    base: Record<string, any> | string | URLSearchParams | undefined,
    ...income: (Record<string, any> | string | URLSearchParams | undefined)[]
  ): Record<string, any> {
    const baseQuery = new URLSearchParams(base);
    for (const incomeQuery of income) {
      const params = new URLSearchParams(incomeQuery);
      params.forEach((value, key) => {
        baseQuery.set(key, value);
      });
    }
    return Object.fromEntries(baseQuery.entries());
  }
  mergeHeaders(
    base: Record<string, any> | Headers | undefined,
    ...income: (Record<string, any> | Headers | undefined)[]
  ): Record<string, any> {
    const headersObject: any = {};
    const baseHeaders = new Headers(base);
    for (const incomeHeaders of income) {
      const header = new Headers(incomeHeaders);
      header.forEach((value, key) => {
        baseHeaders.set(key, value);
      });
    }
    baseHeaders.forEach((value, key) => {
      headersObject[key] = value;
    });
    return headersObject;
  }

  async emit<C = FexiosContext>(event: FexiosLifecycleEvents, ctx: C) {
    const hooks = this.hooks.filter((hook) => hook.event === event);
    try {
      let index = 0;
      for (const hook of hooks) {
        const hookName = `${event}#${hook.action.name || `anonymous#${index}`}`;

        // Set a symbol to check if the hook overrides the original context
        const symbol = Symbol("FexiosHookContext");
        (ctx as any)[symbol] = symbol;

        const newCtx = (await hook.action.call(this, ctx)) as Awaited<
          C | false
        >;

        // Excepted abort signal
        if (newCtx === false) {
          throw new FexiosError(
            FexiosErrorCodes.ABORTED_BY_HOOK,
            `Request aborted by hook "${hookName}"`,
            ctx as FexiosContext,
          );
        }
        // Good
        if (typeof newCtx === "object" && (newCtx as any)[symbol] === symbol) {
          ctx = newCtx as C;
        }
        // Unexpected return value
        else {
          // @ts-ignore prevent esbuild optimize
          const console = globalThis["".concat("console")];
          try {
            throw new FexiosError(
              FexiosErrorCodes.HOOK_CONTEXT_CHANGED,
              `Hook "${hookName}" should return the original FexiosContext or return false to abort the request, but got "${newCtx}".`,
            );
          } catch (e: any) {
            console.warn(e.stack || e);
          }
        }

        // Clean up
        delete (ctx as any)[symbol];

        index++;
      }
    } catch (e) {
      return Promise.reject(e);
    }
    return ctx;
  }
  on<C = FexiosContext>(
    event: FexiosLifecycleEvents,
    action: FexiosHook<C>,
    prepend = false,
  ) {
    if (typeof action !== "function") {
      throw new FexiosError(
        FexiosErrorCodes.INVALID_HOOK_CALLBACK,
        `Hook should be a function, but got "${typeof action}"`,
      );
    }
    this.hooks[prepend ? "unshift" : "push"]({
      event,
      action: action as FexiosHook,
    });
    return this;
  }
  off(event: FexiosLifecycleEvents, action: FexiosHook<any>) {
    this.hooks = this.hooks.filter(
      (hook) => hook.event !== event || hook.action !== action,
    );
    return this;
  }

  private createInterceptor<T extends FexiosLifecycleEvents>(
    event: T,
  ): FexiosInterceptor {
    return {
      handlers: () =>
        this.hooks
          .filter((hook) => hook.event === event)
          .map((hook) => hook.action),
      use: <C = FexiosContext>(hook: FexiosHook<C>, prepend = false) => {
        return this.on(event, hook, prepend);
      },
      clear: () => {
        this.hooks = this.hooks.filter((hook) => hook.event !== event);
      },
    };
  }
  readonly interceptors: FexiosInterceptors = {
    request: this.createInterceptor("beforeRequest"),
    response: this.createInterceptor("afterResponse"),
  };

  private createMethodShortcut(method: FexiosMethods) {
    Object.defineProperty(this, method, {
      value: (
        url: string | URL,
        bodyOrQuery?: Record<string, any> | string | URLSearchParams,
        options?: Partial<FexiosRequestOptions>,
      ) => {
        if (
          this.METHODS_WITHOUT_BODY.includes(
            method.toLocaleLowerCase() as FexiosMethods,
          )
        ) {
          options = bodyOrQuery as any;
        } else {
          options = options || {};
          options.body = bodyOrQuery;
        }
        return this.request(url, {
          ...options,
          method: method as FexiosMethods,
        });
      },
    });
    return this;
  }

  static async resolveResponseBody<T = any>(
    rawResponse: Response,
    expectType?: FexiosConfigs["responseType"],
    onProgress?: (
      progress: number,
      chunk?: Uint8Array,
      buffer?: Uint8Array,
    ) => void,
  ): Promise<FexiosResponse<T>> {
    if (rawResponse.bodyUsed) {
      /* v8 ignore next 5 */
      throw new FexiosError(
        "BODY_USED",
        "Response body has already been used or locked",
      );
    }

    const contentType = rawResponse.headers.get("content-type") || "";
    const contentLength =
      Number(rawResponse.headers.get("content-length")) || 0;

    // Check if the response is a WebSocket
    if (
      (rawResponse.status === 101 ||
        rawResponse.status === 426 ||
        rawResponse.headers.get("upgrade")) &&
      typeof globalThis.WebSocket !== "undefined"
    ) {
      const ws = new WebSocket(rawResponse.url);
      await new Promise((resolve, reject) => {
        ws.onopen = resolve;
        ws.onerror = reject;
      });
      return new FexiosResponse(rawResponse, ws as T, {
        ok: true,
        status: 101,
        statusText: "Switching Protocols",
      });
    }
    // Check if the response is a EventSource
    // But only if the content-type is not 'text' or 'json'
    if (
      contentType.startsWith("text/event-stream") &&
      !["text", "json"].includes(expectType || "") &&
      typeof globalThis.EventSource !== "undefined"
    ) {
      const es = new EventSource(rawResponse.url);
      await new Promise<any>((resolve, reject) => {
        es.onopen = resolve;
        es.onerror = reject;
      });
      return new FexiosResponse(rawResponse, es as T);
    }
    // Check if expectType is 'stream'
    if (expectType === "stream") {
      return new FexiosResponse(
        rawResponse,
        safeDestr<T>(await rawResponse.text()),
      );
    }

    const preferType =
      expectType ||
      detectResponseType(rawResponse.headers.get("content-type") || "");

    if (!expectType && preferType === "stream") {
      let count = 0;
      const transformer = new TransformStream({
        transform(chunk, controller) {
          controller.enqueue(chunk);
          count += chunk.length;
          onProgress?.(count, chunk);
        },
        flush(controller) {
          controller.terminate();
        },
      });
      return new FexiosResponse(
        rawResponse,
        rawResponse.body?.pipeThrough(transformer) as ReadableStream as T,
      );
    }
    if (!expectType && preferType === "blob") {
      return new FexiosResponse(
        rawResponse,
        <any>await rawResponse.blob()
      )
    }

    if (
      expectType === "blob" ||
      contentType.startsWith("image/") ||
      contentType.startsWith("video/") ||
      contentType.startsWith("audio/")
    ) {
      return new FexiosResponse(rawResponse, <any>await rawResponse.blob());
    }

    // Check if the response is a ReadableStream
    const stream = rawResponse.body;
    if (!stream) {
      /* v8 ignore next 5 */
      throw new FexiosError(
        FexiosErrorCodes.NO_BODY_READER,
        "Failed to get ReadableStream from response body",
      );
    }
    const buffer = await readToUint8Array(
      stream, // allowing preallocating buffer
      +(rawResponse.headers.get("content-length") || 0),
      onProgress,
    );

    const res = new FexiosResponse(rawResponse, undefined as any);

    // Guess the response type, maybe a Blob?
    if (!this.isText(buffer)) {
      res.data = new Blob([buffer], {
        type: rawResponse.headers.get("content-type") || undefined,
      }) as Blob as T;
    }
    // Otherwise, try to decode the buffer as text
    else {
      res.data = new TextDecoder().decode(buffer) as T;
    }

    // If the data resolved as a string above, try to parse it as JSON
    if (
      typeof res.data === "string" &&
      expectType !== "text" &&
      (expectType === "json" || contentType.startsWith("application/json"))
    ) {
      try {
        res.data = safeDestr<T>(res.data);
      } catch (e) {
        console.warn("Failed to parse response data as JSON:", e);
      }
    }

    // Fall back to the buffer if the data is still not resolved
    if (typeof res.data === "undefined") {
      res.data = buffer.length > 0 ? (buffer as any) : undefined;
    }

    return checkThrow(res);
  }

  static isText(uint8Array: Uint8Array, maxBytesToCheck = 1024) {
    // 确保输入是一个 Uint8Array
    if (!(uint8Array instanceof Uint8Array)) {
      /* v8 ignore next 2 */
      throw new TypeError("Input must be a Uint8Array");
    }

    // 截取前 maxBytesToCheck 字节进行检查
    const dataToCheck = uint8Array.slice(0, maxBytesToCheck);

    // 使用 TextDecoder 尝试解码为 UTF-8 字符串
    const decoder = new TextDecoder("utf-8", { fatal: true });
    try {
      const decodedString = decoder.decode(dataToCheck);

      // 检查解码后的字符串是否包含大量不可打印字符
      const nonPrintableRegex = /[\x00-\x08\x0E-\x1F\x7F]/g; // 匹配控制字符
      const nonPrintableMatches = decodedString.match(nonPrintableRegex);

      // 如果不可打印字符占比过高，则认为是二进制数据
      const threshold = 0.1; // 允许最多 10% 的不可打印字符
      if (
        nonPrintableMatches &&
        nonPrintableMatches.length / decodedString.length > threshold
      ) {
        return false; // 是二进制数据
      }

      // 否则认为是文本数据
      return true;
    } catch (error) {
      // 如果解码失败（例如包含无效的 UTF-8 序列），认为是二进制数据
      return false;
    }
  }

  extends(configs: Partial<FexiosConfigs>) {
    const fexios = new Fexios({ ...this.baseConfigs, ...configs });
    fexios.hooks = [...this.hooks];
    return fexios;
  }

  readonly create = Fexios.create;
  static create(configs?: Partial<FexiosConfigs>) {
    return new Fexios(configs);
  }
}

// declare method shortcuts
export interface Fexios {
  get: FexiosRequestShortcut<"get">;
  post: FexiosRequestShortcut<"post">;
  put: FexiosRequestShortcut<"put">;
  patch: FexiosRequestShortcut<"patch">;
  delete: FexiosRequestShortcut<"delete">;
  head: FexiosRequestShortcut<"head">;
  options: FexiosRequestShortcut<"options">;
  trace: FexiosRequestShortcut<"trace">;
}

// Support for direct import
export const createFexios = Fexios.create;
export const fexios = createFexios();
export default fexios;
