export type MessageHandler<S, D, K extends string = string> = {
  key: K;
  callback: (state: S, data: D) => S;
  state: S;
};

export function createMessageHandler<
  S = unknown,
  D = unknown,
  K extends string = string
>(
  key: K,
  callback: (state: S, data: D) => S,
  state: S
): MessageHandler<S, D, K> {
  return {
    key,
    callback,
    state,
  };
};


