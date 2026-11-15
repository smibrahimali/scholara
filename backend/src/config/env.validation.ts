export function validateEnv(config: Record<string, unknown>) {
  const required = ['DATABASE_URL', 'JWT_SECRET'] as const;
  const missing = required.filter((key) => {
    const value = config[key];
    if (value === undefined || value === null) return true;
    const asString = typeof value === 'string' ? value : '';
    return asString.trim() === '' || asString.includes('your_');
  });

  if (missing.length > 0) {
    throw new Error(
      `Missing or placeholder environment variables: ${missing.join(', ')}. Update root .env`,
    );
  }

  return config;
}
