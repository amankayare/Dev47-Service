const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ValidationResult<T> {
  valid: boolean;
  data?: T;
  errors?: Record<string, string[]>;
}

export function validateRegistration(
  body: unknown,
): ValidationResult<{ username: string; email: string; password: string }> {
  const errors: Record<string, string[]> = {};
  if (!body || typeof body !== "object") {
    return {
      valid: false,
      errors: { _schema: ["Invalid request body."] },
    };
  }

  const record = body as Record<string, unknown>;
  const username = typeof record.username === "string" ? record.username.trim() : "";
  const email = typeof record.email === "string" ? record.email.trim() : "";
  const password = typeof record.password === "string" ? record.password : "";

  if (!username) {
    errors.username = ["Missing data for required field."];
  } else if (username.length < 3 || username.length > 80) {
    errors.username = ["Length must be between 3 and 80."];
  }

  if (!email) {
    errors.email = ["Missing data for required field."];
  } else if (!EMAIL_REGEX.test(email)) {
    errors.email = ["Not a valid email address."];
  }

  if (!password) {
    errors.password = ["Missing data for required field."];
  } else if (password.length < 6) {
    errors.password = ["Shorter than minimum length 6."];
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: { username, email, password },
  };
}

export function validateLogin(
  body: unknown,
): ValidationResult<{ username: string; password: string }> {
  const errors: Record<string, string[]> = {};
  if (!body || typeof body !== "object") {
    return {
      valid: false,
      errors: { _schema: ["Invalid request body."] },
    };
  }

  const record = body as Record<string, unknown>;
  const username = typeof record.username === "string" ? record.username.trim() : "";
  const password = typeof record.password === "string" ? record.password : "";

  if (!username) {
    errors.username = ["Missing data for required field."];
  }
  if (!password) {
    errors.password = ["Missing data for required field."];
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, data: { username, password } };
}

export function validateProfileUpdate(
  body: unknown,
): ValidationResult<{ username: string; email: string }> {
  const errors: Record<string, string[]> = {};
  if (!body || typeof body !== "object") {
    return {
      valid: false,
      errors: { _schema: ["Invalid request body."] },
    };
  }

  const record = body as Record<string, unknown>;
  const username = typeof record.username === "string" ? record.username.trim() : "";
  const email = typeof record.email === "string" ? record.email.trim() : "";

  if (!username) {
    errors.username = ["Missing data for required field."];
  } else if (username.length < 3 || username.length > 80) {
    errors.username = ["Length must be between 3 and 80."];
  }

  if (!email) {
    errors.email = ["Missing data for required field."];
  } else if (!EMAIL_REGEX.test(email)) {
    errors.email = ["Not a valid email address."];
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, data: { username, email } };
}
