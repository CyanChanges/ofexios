import { describe, expect, it } from 'vitest';
import fexios, {
	Fexios,
	FexiosError,
	type FexiosFinalContext,
	FexiosResponse,
	FexiosResponseError,
	isFexiosError,
} from '../src/index';
import type { EchoResponse } from './MockData';
import { ECHO_BASE_URL } from './constants';

const time = String(Date.now());

describe('Fexios Core', () => {
	it('Request with full url', async () => {
		const { data } = await fexios.get<EchoResponse>(`${ECHO_BASE_URL}/get`);
		expect(data).to.be.an('object');
	});

	it('Request to absolute path with baseURL', async () => {
		const fexios = new Fexios({
			baseURL: ECHO_BASE_URL,
		});
		const { data } = await fexios.get<EchoResponse>('/path/to/anywhere');
		expect(data.url).to.equal(`${ECHO_BASE_URL}/path/to/anywhere`);
	});

	it('Pass first argument as options', async () => {
		const { data } = await fexios.request<EchoResponse>({
			url: `${ECHO_BASE_URL}/get`,
		});
		expect(data).to.be.an('object');
	});

	it('Merge query params', async () => {
		const fexios = new Fexios({
			baseURL: ECHO_BASE_URL,
		});
		const fexiosWithQueryInit = fexios.extends({
			query: {
				one: '001',
				two: '002',
			},
		});

		// baseOptions
		const { data: data1 } = await fexiosWithQueryInit.get<EchoResponse>('');
		expect(data1.searchParams.one).to.equal('001');

		// requestOptions
		const { data: data2 } = await fexios.get<EchoResponse>('/get', {
			query: {
				one: '111',
			},
		});
		expect(data2.searchParams.one).to.equal('111');

		// requestOptions > urlParams > baseOptions
		const { data: data3 } = await fexiosWithQueryInit.get<EchoResponse>(
			'/get?two=222',
			{
				query: {
					three: '333',
				},
			},
		);
		expect(data3.searchParams).to.deep.equal({
			one: '001',
			two: '222',
			three: '333',
		});
	});

	it('GET should not have body', async () => {
		const promise = fexios.get<EchoResponse>(`${ECHO_BASE_URL}/get`, {
			body: 'test',
		});
		await expect(promise).to.rejects.with.instanceOf(FexiosError);
		await expect(promise).to.rejects.that.satisfies(isFexiosError);
	});

	it('Bad status should throw ResponseError', async () => {
		const promise = fexios.get<EchoResponse>(`${ECHO_BASE_URL}/_status/404`);

		await expect(promise).to.rejects.instanceOf(FexiosResponseError);
		await expect(promise).to.rejects.not.satisfies(isFexiosError);
		await expect(promise).to.rejects.that.have.nested.property(
			'response.data',
			'404',
		);
	});

	it('POST with JSON', async () => {
		const { data } = await fexios.post<EchoResponse>(`${ECHO_BASE_URL}/post`, {
			time,
		});
		expect(data.body.time).to.equal(time);
	});

	it('POST with URLSearchParams', async () => {
		const form = new URLSearchParams();
		const time = String(Date.now());
		form.append('time', time);
		const { data } = await fexios.post<EchoResponse>(
			`${ECHO_BASE_URL}/post`,
			form,
		);
		expect(data.formData?.time).to.equal(time);
	});

	it('POST with FormData', async () => {
		const form = new FormData();
		const time = String(Date.now());
		form.append('time', time);
		const { data } = await fexios.post<EchoResponse>(
			`${ECHO_BASE_URL}/post`,
			form,
		);
		expect(data.formData?.time).to.equal(time);
	});

	it('Callable instance', async () => {
		const { data: data1 } = (await fexios(`${ECHO_BASE_URL}/`, {
			method: 'POST',
		})) as FexiosFinalContext<EchoResponse>;
		expect(data1).to.be.an('object');
		expect(data1.method).to.equal('POST');
	});
});
