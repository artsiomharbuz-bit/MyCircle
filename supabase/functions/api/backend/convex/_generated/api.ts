const functionName = Symbol.for('functionName');

function createApi(parts: string[] = []): any {
  return new Proxy(() => undefined, {
    get(_target, prop) {
      if (prop === functionName) {
        if (parts.length < 2) return undefined;
        return `${parts.slice(0, -1).join('/')}:${parts.at(-1)}`;
      }
      if (typeof prop === 'symbol') return undefined;
      return createApi([...parts, prop]);
    },
  });
}

export const api = createApi();
export const internal = createApi();
export const components = createApi();
