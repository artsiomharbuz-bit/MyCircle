const functionName = Symbol.for('functionName');

function createApi(parts: string[] = []): any {
  return new Proxy(() => undefined, {
    get(_target, property) {
      if (property === functionName) {
        if (parts.length < 2) return undefined;
        return `${parts.slice(0, -1).join('/')}:${parts.at(-1)}`;
      }
      if (typeof property === 'symbol') return undefined;
      return createApi([...parts, property]);
    },
  });
}

export const api = createApi();
