declare global {
  interface Window {
    electronAPI?: {
      toggleProtection: (enable: boolean) => Promise<boolean>;
      getAudioSources: () => Promise<any[]>;
      requestAudioPermission: () => Promise<boolean>;
    };
  }
}

export {};