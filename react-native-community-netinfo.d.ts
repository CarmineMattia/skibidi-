declare module '@react-native-community/netinfo' {
  export interface NetInfoState {
    isConnected: boolean | null;
    [key: string]: unknown;
  }

  export type NetInfoStateChangeCallback = (state: NetInfoState) => void;

  export interface NetInfoStatic {
    addEventListener(callback: NetInfoStateChangeCallback): () => void;
    fetch(): Promise<NetInfoState>;
  }

  const NetInfo: NetInfoStatic;
  export default NetInfo;
}

