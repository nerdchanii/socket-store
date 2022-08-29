export interface ISocketStore {
  /**
   * method related to the socket
   */
  onConnect(): void;
  onMessage(message: MessageEvent): void;
  send({ key, data }: { key: string; data: any }): void;

  /**
   * method related to the store
   */
  setData({ key, state }: { key: string; state: any }): void;
  getState(key: string): any;
  subscribe(key: string, listener: (state: any) => void): void;
  notify(key: string): void;
}

export type Store = {
  [key: string]: {
    state: any;
    callback: (state: any, data: any) => void;
  };
};
