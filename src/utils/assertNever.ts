// Only for internally-constructed unions; reaching this means a case was forgotten in our own code.
export function assertNever(value: never): never {
  throw new Error(`Unhandled value: ${JSON.stringify(value)}`);
}
