export class FexiosResponse<T = any> {
	public ok: boolean;
	public status: number;
	public statusText: string;
	public headers: Headers;
	constructor(
		public rawResponse: Response,
		public data: T,
		overrides?: Partial<Omit<FexiosResponse<T>, 'rawResponse' | 'data'>>,
	) {
		this.ok = rawResponse.ok;
		this.status = rawResponse.status;
		this.statusText = rawResponse.statusText;
		this.headers = rawResponse.headers;
		for (const [key, value] of Object.entries(overrides || {})) {
			(this as any)[key] = value;
		}
	}
}
