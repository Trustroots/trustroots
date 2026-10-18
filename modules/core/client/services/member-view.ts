export const viewNavigation = {
  reload() {
    window.location.reload();
  },
  transition(path: string) {
    try {
      window.localStorage.setItem('trustroots-view-change', String(Date.now()));
    } finally {
      window.location.assign(path);
    }
  },
};
declare global {
  interface Window {
    viewContext?: {
      generation: string;
      username?: string;
      expiresAt?: number;
      expired?: boolean;
    } | null;
  }
}
