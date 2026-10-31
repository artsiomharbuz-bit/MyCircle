export type Id<_TableName extends string = string> = string;
export type Doc<_TableName extends string = string> = Record<string, any> & {
  _id: string;
  _creationTime: number;
};
