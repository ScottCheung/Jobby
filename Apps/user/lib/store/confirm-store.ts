import { create } from 'zustand';

type ConfirmState = {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  resolve: ((value: boolean) => void) | null;
  type?: 'delete' | 'remove' | 'warning' | 'info';
};

type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  type?: 'delete' | 'remove' | 'warning' | 'info';
};

type ConfirmStore = ConfirmState & {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  close: () => void;
};

export const useConfirmStore = create<ConfirmStore>()((set, get) => ({
  isOpen: false,
  title: '',
  message: '',
  confirmLabel: 'Confirm',
  cancelLabel: 'Cancel',
  resolve: null,
  type: undefined,
  confirm: (options) =>
    new Promise<boolean>((resolve) => {
      set({
        isOpen: true,
        title: options.title,
        message: options.message,
        confirmLabel: options.confirmLabel ?? 'Confirm',
        cancelLabel: options.cancelLabel ?? 'Cancel',
        type: options.type,
        resolve,
      });
    }),
  close: () => {
    const { resolve } = get();
    resolve?.(false);
    set({
      isOpen: false,
      title: '',
      message: '',
      confirmLabel: 'Confirm',
      cancelLabel: 'Cancel',
      type: undefined,
      resolve: null,
    });
  },
}));

export function resolveConfirm(value: boolean) {
  const { resolve } = useConfirmStore.getState();
  resolve?.(value);
  useConfirmStore.setState({
    isOpen: false,
    title: '',
    message: '',
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel',
    type: undefined,
    resolve: null,
  });
}
