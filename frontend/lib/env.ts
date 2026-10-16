const values = Object.freeze({
  API_BASE_URL: process.env.NEXT_PUBLIC_API_URL || '/api',
});

export const Env = Object.freeze({
  get(key: keyof typeof values) {
    if (!(key in values)) {
      throw new Error(`Unknown public environment key: ${key}`);
    }

    return values[key];
  },
});