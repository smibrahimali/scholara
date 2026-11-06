export function validateEnv(config: Record<string, unknown>) {
  const required = ['DATABASE_URL', 'JWT_SECRET'] as const;
  const missing = required.filter((key) => {
    const value = config[key];
    return (
      value === undefined ||
      value === null ||
      String(value).trim() === '' ||
      String(value).includes('your_')
    );
  });

  if (missing.length > 0) {
    throw new Error(
      `Missing or placeholder environment variables: ${missing.join(', ')}. Update root .env`,
    );
  }

  return config;
}
