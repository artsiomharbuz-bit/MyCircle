const functionName = Symbol.for('functionName');

function createApi(parts = []) {
  return new Proxy(() => undefined, {
    get(_target, property) {
      if (property === functionName) {
        return parts.length >= 2
          ? `${parts.slice(0, -1).join('/')}:${parts.at(-1)}`
          : undefined;
      }
      if (typeof property === 'symbol') return undefined;
      return createApi([...parts, property]);
    },
  });
}

export const api = createApi();
export const internal = createApi();
export const components = createApi();
