export class ConvexError extends Error {
  data: unknown;
  constructor(messageOrData: string | unknown) {
    super(typeof messageOrData === 'string' ? messageOrData : 'Request failed.');
    this.name = 'ConvexError';
    this.data = messageOrData;
  }
}

const makeValidator = (): any => new Proxy(() => ({}), {
  get: () => makeValidator(),
  apply: () => makeValidator(),
});

export const v: any = new Proxy({}, { get: () => makeValidator() });
