'use client';

import { Modal } from '@/components/layout/modal';
import { useGlobalModalStore } from '@/lib/store/global-modal-store';

export function GlobalModal() {
  const config = useGlobalModalStore((state) => state.config);
  const closeModal = useGlobalModalStore((state) => state.actions.closeModal);

  const handleClose = () => {
    config?.onClose?.();
    closeModal();
  };

  return (
    <Modal
      isOpen={Boolean(config)}
      onClose={handleClose}
      className={config?.className || 'max-w-2xl'}
      layoutId={config?.layoutId}
    >
      {config?.content}
    </Modal>
  );
}
