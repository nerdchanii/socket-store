export type MessageHandler<S, D> = {
  key: string;
  callback: (state: S, data: D) => void;
  state: S;
};

const createMessageHandler = <S, D>(
  key: string,
  callback: (state: S, data: D) => S,
  state: S
): MessageHandler<S, D> => {
  return {
    key,
    callback(state: S, data: D) {
      return callback(state, data);
    },
    state,
  };
};

export default createMessageHandler;
