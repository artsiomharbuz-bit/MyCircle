type FunctionDefinition = { handler?: (ctx: any, args: any) => any } | ((ctx: any, args: any) => any);
type Registered = { _handler: (ctx: any, args: any) => any; _internal: boolean };

function register(definition: FunctionDefinition, isInternal: boolean): Registered {
  const handler = typeof definition === 'function' ? definition : definition.handler;
  if (!handler) throw new Error('A backend function must define a handler.');
  return { _handler: handler, _internal: isInternal };
}

export const query = (definition: FunctionDefinition) => register(definition, false);
export const mutation = (definition: FunctionDefinition) => register(definition, false);
export const action = (definition: FunctionDefinition) => register(definition, false);
export const internalQuery = (definition: FunctionDefinition) => register(definition, true);
export const internalMutation = (definition: FunctionDefinition) => register(definition, true);
export const internalAction = (definition: FunctionDefinition) => register(definition, true);
export const httpAction = (definition: FunctionDefinition) => register(definition, false);
export type QueryCtx = any;
export type MutationCtx = any;
export type ActionCtx = any;
