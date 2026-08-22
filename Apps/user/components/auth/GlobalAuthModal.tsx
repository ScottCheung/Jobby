/** @format */

'use client';

import React from 'react';
import { useAuthModalStore } from '@/lib/store/auth-modal-store';
import { Modal } from '@jobby/ui';
import { AuthForm } from './AuthForm';

export function GlobalAuthModal() {
  const isOpen = useAuthModalStore((state) => state.isOpen);
  const mode = useAuthModalStore((state) => state.mode);
  const next = useAuthModalStore((state) => state.next);
  const reason = useAuthModalStore((state) => state.reason);
  const onSuccess = useAuthModalStore((state) => state.onSuccess);
  const closeAuthModal = useAuthModalStore(
    (state) => state.actions.closeAuthModal,
  );

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={closeAuthModal}
      className='max-w-md p-6 sm:p-8 bg-panel/95 backdrop-blur-2xl border border-primary/60 rounded-3xl shadow-2xl overflow-hidden'
    >
      <AuthForm
        initialMode={mode}
        next={next}
        reason={reason}
        isModal={true}
        onSuccess={() => {
          if (onSuccess) onSuccess();
          closeAuthModal();
        }}
        onClose={closeAuthModal}
      />
    </Modal>
  );
}
