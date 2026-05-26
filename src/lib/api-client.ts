export class ApiError extends Error {
  readonly code: string
  readonly status: number

  constructor(message: string, status: number, code = 'UNKNOWN_ERROR') {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

type ApiErrorResponse = {
  code?: string
  message?: string
}

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: BodyInit | object | null
}

export async function apiClient<TResponse>(
  path: string,
  options: RequestOptions = {},
): Promise<TResponse> {
  const headers = new Headers(options.headers)
  const hasJsonBody =
    options.body !== undefined &&
    options.body !== null &&
    !(options.body instanceof FormData)

  if (hasJsonBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  let requestBody: BodyInit | null | undefined = null

  if (options.body === undefined || options.body === null) {
    requestBody = null
  } else if (hasJsonBody && typeof options.body === 'object') {
    requestBody = JSON.stringify(options.body)
  } else {
    requestBody = options.body as BodyInit
  }

  const response = await fetch(`/api${path}`, {
    ...options,
    headers,
    body: requestBody,
  })

  if (!response.ok) {
    const errorBody = (await response
      .json()
      .catch(() => null)) as ApiErrorResponse | null
    throw new ApiError(
      errorBody?.message ?? 'Die Anfrage konnte nicht verarbeitet werden.',
      response.status,
      errorBody?.code ?? 'UNKNOWN_ERROR',
    )
  }

  if (response.status === 204) {
    return undefined as TResponse
  }

  return (await response.json()) as TResponse
}
