export type MessageHandler<S, D> = {
  key: string;
  callback: (state: S, data: D) => void;
  state: S;
};

export function createMessageHandler<S = unknown, D = unknown>(
  key: string,
  callback: (state: S, data: D) => S,
  state: S
): MessageHandler<S, D> {
  return {
    key,
    callback,
    state,
  };
};



