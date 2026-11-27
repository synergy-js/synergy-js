/**
 * Generic utility class and functions that enforces strict type safety on response bodies and automatically handles HTTP errors, which standard fetch does not do by default.
 *
 * ### Step-by-Step Breakdown
 * 1. Custom Error Handling: Native fetch only rejects a promise during network failures. Extending the Error class ensures that HTTP codes like 404 or 500 throw catchable exceptions containing response context.
 * 2. Response Generics (<TResponse>): Passing a generic parameter allows TypeScript to seamlessly cast response.json() into your expected data contract without manually typing as MyDataType everywhere
 * 3. Body Serialization: The wrapper checks if the request body is a standard JavaScript object and stringifies it automatically, eliminating repetitive JSON.stringify(data) calls.
 * 4. Fallback for Empty Responses: Added logic to handle status code 204 No Content to prevent the wrapper from crashing when running .json() on an empty body.
 * 5. Per instance `request` `response` and `error` interceptors. By using `this.request`, JavaScript explicitly binds the network execution to whichever specific variable you created.
 * When you instantiate two separate clients, they don't share memory, variables, or configs
 *
 *  ### Benefits
 * `Proper Type Interception`: Designing your interceptors to allow asynchronous adjustments (Promise<IHttpClientOptions>) means your client can seamlessly handle complex workflows like waiting to refresh an expired OAuth security token before sending a request.
 *
 * `Use of URLSearchParams`: Safely appending parameters and conditionally handling existing query markers (? vs &) shows you really thought through real-world API routing.
 *
 * `Resilient URL Cleanup`: Your regex line baseUrl.replace(/\/+$/, "") is a lifesaver. It completely eliminates accidental triple-slashes (https://api.com), which is one of the most common configuration bugs in frontend apps.
 *
 * `Smart Content-Type Management`: Automatically assigning "application/json" for objects, but knowing to completely strip or ignore it for FormData or empty GET requests, is excellent. Many developers mess this up, causing file uploads or text bodies to break.
 * @module HttpClient
 */

/**
 * Custom error class to handle non-2xx responses
 * */
export class HttpError extends Response {
	status: number
	
	message: string
	
	// Accept a raw number and a message
	constructor(status: number, message: string = "An http error occurred") {
		// Create the JSON response string
		const body = JSON.stringify({error: message})
		
		// Pass it directly to the native Response engine
		super(body, {
			status: status,
			statusText: message,
			headers: {"Content-Type": "application/json"},
		})
		
		this.status = status
		this.message = message
	}
}

/**
 * Each instance of `HttpClient` gets its own isolated set of interceptors.
 * This is achieved by explicitly calling `this.request` instead of a global `http` function
 *```
 *                   ┌───────────────────────┐
 *                   │  HttpClient           │
 *                   └───────────┬───────────┘
 *                               │
 *              ┌────────────────┴────────────────┐
 *              ▼                                 ▼
 *    [ Instance 1: mainApi ]           [ Instance 2: cmsApi ]
 *   ┌───────────────────────┐         ┌───────────────────────┐
 *   │ https://mainApi.com   │         │ https://cmsApi.com    │
 *   ├───────────────────────┤         ├───────────────────────┤
 *   │ Interceptor:          │         │ Interceptor:          │
 *   │ • Injects JWT Token   │         │ • Unwraps payload data│
 *   └───────────────────────┘         └───────────────────────┘
 *```
 * @example
 * ```ts
 * // Instantiating isolated objects
 * export const mainApi = new HttpClient("https://mainApi.com")
 * export const cmsApi = new HttpClient("https://cmsApi.com")
 *
 * // Adding an interceptor ONLY modifies the "mainApi" object box
 * mainApi.interceptors.request = (options) => { ... }
 *
 * // Under the hood:
 * mainApi.get('/users') // "this" points to mainApi -> runs token interceptor
 * cmsApi.get('/posts')  // "this" points to cmsApi  -> interceptor is completely undefined/skipped
 * ```
 */
export interface Interceptors {
	/**
	 * @example Append Auth token to default headers
	 * ```ts
	 * export const mainApi = new HttpClient('https://mycompany.com')
	 * mainApi.interceptors.request = (options) => {
	 *   options.headers = { ...options.headers, Authorization: `Bearer ${localStorage.getItem('token')}` }
	 *   return options
	 * }
	 * ```
	 */
	request?: (options: HttpClientOptions) => HttpClientOptions | Promise<HttpClientOptions>
	/**
	 * Many backends wrap their real data inside an envelope payload like { success: true, statusCode: 200, data: { username: "Alice" }}.
	 *
	 * With a response interceptor, you can strip away the boilerplate wrapper globally
	 *
	 * @example
	 * ```ts
	 * httpClient.interceptors.response = (response, serverPayload: any) => {
	 *   console.log("Response arrived from server!")
	 *
	 *   // If the server payload contains an envelope, unwrap it right here
	 *   if (serverPayload && serverPayload.data !== undefined) {
	 *     return serverPayload.data // Now the component only gets { username: "Alice" }
	 *   }
	 *
	 *   return serverPayload
	 * }
	 * ```
	 */
	response?: <T>(response: Response, data: T) => T | Promise<T>
	/**
	 * If the server returns a 4xx or 5xx error code, the code skips the response interceptor and jumps straight into the error interceptor. This is incredibly useful for global security routing
	 * @example
	 * ```ts
	 * httpClient.interceptors.error = (error) => {
	 *   // Check if the error is an HttpError and specifically an unauthorized 401
	 *   if (error instanceof HttpError && error.response.status === 401) {
	 *     console.warn("User token is invalid or expired. Redirecting...")
	 *
	 *     localStorage.clear()
	 *     window.location.href = '/login' // Instantly kicks them out
	 *
	 *     return // Stop execution
	 *   }
	 *
	 *   // If it's a regular error (like a 500), let the component handle it locally
	 *   throw error
	 * }
	 * ```
	 */
	error?: (error: HttpError | Error) => any | Promise<any>
}

/**
 * Extends native RequestInit to allow easier body passing
 * */
export interface HttpClientOptions extends Omit<RequestInit, "body"> {
	body?: Record<string, unknown> | BodyInit
	baseUrl?: string
	/**
	 * Removes the burden of manually concatenating ?id=123 strings onto your target paths
	 */
	params?: Record<string, string | number | boolean | undefined>
}

export class HttpClient {
	private readonly baseUrl: string
	
	private readonly defaultOptions: HttpClientOptions
	
	public interceptors: Interceptors = {}
	
	constructor(baseUrl: string, defaultOptions: HttpClientOptions = {}) {
		this.baseUrl = baseUrl
		this.defaultOptions = defaultOptions
	}
	
	public async request<TResponse>(path: string,
		options: HttpClientOptions): Promise<TResponse> {
		// Merge default options with request options
		let mergedOptions: HttpClientOptions = {
			...this.defaultOptions,
			...options,
			headers: {
				...(this.defaultOptions.headers as Record<string, string>),
				...(options.headers as Record<string, string>),
			},
			baseUrl: options.baseUrl || this.baseUrl,
		}
		
		// Execute request interceptor
		if(this.interceptors.request) {
			mergedOptions = await this.interceptors.request(mergedOptions)
		}
		
		const {body, baseUrl, params, ...customConfig} = mergedOptions
		
		// Convert headers into a standard Headers collection instance
		const headers = new Headers(
			customConfig.headers as Record<string, string>,
		)
		
		// Only assign JSON Content-Type if there's a payload, and it isn't raw binary, form data
		if(body && !(body instanceof FormData) && !(body instanceof Blob)) {
			if(!headers.has("Content-Type")) {
				headers.set("Content-Type", "application/json")
			}
		}
		
		// Clear content headers entirely for empty read requests (GET / DELETE)
		if(!body) {
			headers.delete("Content-Type")
		}
		
		let serializedBody: BodyInit | undefined
		
		if(body) {
			// This guarantees that if someone passes a Uint8Array, a custom class constructor, or any other native binary type as a body payload, the client won't accidentally corrupt it into a broken "{}" JSON string.
			const isPlainObject =
				typeof body === "object" &&
				Object.getPrototypeOf(body) === Object.prototype
			serializedBody = isPlainObject
			                 ? JSON.stringify(body)
			                 : (body as BodyInit)
		}
		
		// Use regex to strip accidental double-slashes and handles missing base URLs
		let finalUrl = baseUrl
		               ? `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`
		               : path
		
		if(params) {
			const searchParams = new URLSearchParams()
			Object.entries(params).forEach(([key, val]) => {
				if(val !== undefined && val !== null)
					searchParams.append(key, String(val))
			})
			
			const queryString = searchParams.toString()
			if(queryString) {
				finalUrl += (finalUrl.includes("?") ? "&" : "?") + queryString
			}
		}
		
		const finalConfig: RequestInit = {
			...customConfig,
			headers,
			...(serializedBody && {body: serializedBody}),
		}
		
		try {
			const response = await fetch(finalUrl, finalConfig)
			
			// 3. Process Failure Lifecycle
			if(!response.ok) {
				throw new HttpError(response.status, response.statusText || "An http error occurred")
			}
			
			// 4. Handle Empty Content or specific success actions
			const isNoContent = response.status === 204
			const contentType = response.headers.get("content-type")
			const isJson =
				contentType && contentType.includes("application/json")
			
			let data: TResponse
			if(isNoContent) {
				data = {} as TResponse
			}
			else if(isJson) {
				data = (await response.json()) as TResponse
			}
			else if(contentType?.includes("text/")) {
				data = (await response.text()) as TResponse
			}
			else {
				data = {} as TResponse
			}
			
			
			// 5. Execute Global Response Interceptor
			if(this.interceptors.response) {
				data = await this.interceptors.response(response, data)
			}
			
			return data
		}
		catch(error: any) {
			// 6. Execute Global Error Interceptor
			if(this.interceptors.error) {
				return await this.interceptors.error(error)
			}
			throw error
		}
	}
	
	public get = <T>(path: string, config?: HttpClientOptions): Promise<T> =>
		this.request<T>(path, {method: "GET", ...config})
	
	public post = <T>(
		path: string,
		body?: any,
		config?: HttpClientOptions,
	): Promise<T> => this.request<T>(path, {method: "POST", body, ...config})
	
	public put = <T>(
		path: string,
		body?: any,
		config?: HttpClientOptions,
	): Promise<T> => this.request<T>(path, {method: "PUT", body, ...config})
	
	public delete = <T>(
		path: string,
		config?: HttpClientOptions,
	): Promise<T> => this.request<T>(path, {method: "DELETE", ...config})
}

/**
 * Collection of common http status codes
 */
export const HttpStatusCodes = {
	/** Request has succeeded
	 * @see https://datatracker.ietf.org/doc/html/rfc7231#section-6.3.1
	 */
	OK: 200,
	
	/**
	 * The request has succeeded and a new resource has been created as a result of it. This is typically the response sent after a PUT request.
	 * @see https://tools.ietf.org/html/rfc7231#section-6.3.2
	 */
	CREATED: 201,
	
	/**
	 * The request has been accepted for processing, but the processing has not been completed.
	 * @see https://datatracker.ietf.org/doc/html/rfc7231#section-6.3.3
	 */
	ACCEPTED: 202,
	
	/**
	 *  The server has successfully fulfilled the request and that there is no additional
	 *  content to send in the response payload body.
	 *  @see https://datatracker.ietf.org/doc/html/rfc7231#section-6.3.5
	 */
	NO_CONTENT: 204,
	
	/**
	 * Indicates that the server cannot or will not process the request due to something that is perceived to be
	 * a client error (e.g., malformed request syntax, invalid request message framing, or deceptive request routing).
	 * @see https://datatracker.ietf.org/doc/html/rfc7231#section-6.5.1
	 */
	BAD_REQUEST: 400,
	
	/**
	 * The server encountered an unexpected condition that prevented it from fulfilling the request.
	 * @see https://tools.ietf.org/html/rfc7231#section-6.6.1
	 */
	INTERNAL_SERVER_ERROR: 500,
	
	/***
	 * This error response means that the server, while working as a gateway to get a response needed to handle the request, got an invalid response.
	 * @see https://datatracker.ietf.org/doc/html/rfc7231#section-6.6.3
	 */
	BAD_GATEWAY: 502,
} as const
