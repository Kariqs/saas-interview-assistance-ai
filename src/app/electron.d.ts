declare global {
  interface Window {
    electronAPI?: {
      toggleProtection: (enable: boolean) => Promise<boolean>;
      getAudioSources: () => Promise<unknown[]>;
      requestAudioPermission: () => Promise<boolean>;
      openExternal: (url: string) => Promise<boolean>;
    };
  }
}

export {};
