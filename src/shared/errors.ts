export class ValidationError extends Error {
  readonly code = 'VALIDATION_ERROR';
}

export class NotFoundError extends Error {
  readonly code = 'NOT_FOUND';
}

export class ConflictError extends Error {
  readonly code = 'CONFLICT';
}

export class ProviderError extends Error {
  readonly code: string = 'PROVIDER_ERROR';
}

export class ProviderAuthenticationError extends ProviderError {
  override readonly code = 'PROVIDER_AUTHENTICATION_ERROR';
}

export class ProviderRateLimitError extends ProviderError {
  override readonly code = 'PROVIDER_RATE_LIMIT_ERROR';
}

export class ProviderUnavailableError extends ProviderError {
  override readonly code = 'PROVIDER_UNAVAILABLE_ERROR';
}

export class ProviderValidationError extends ProviderError {
  override readonly code = 'PROVIDER_VALIDATION_ERROR';
}

export class RenderingError extends Error {
  readonly code = 'RENDERING_ERROR';
}
