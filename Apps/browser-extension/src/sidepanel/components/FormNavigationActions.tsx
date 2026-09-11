import { Button } from '@jobby/ui/components/UI/Button';

import type { ApplicationAction } from '../../shared/contracts/application-navigation';
import type { FormInspection } from '../../shared/contracts/form-inspection';

interface FormNavigationActionsProps {
  latestForm: FormInspection | null;
  loadingButton: string | null;
  isClearingForm: boolean;
  onApplicationAction: (action: ApplicationAction) => void;
  authConnected?: boolean;
  onSignIn?: () => void;
}

export function FormNavigationActions({
  latestForm,
  loadingButton,
  isClearingForm,
  onApplicationAction,
  authConnected = true,
  onSignIn,
}: FormNavigationActionsProps) {
  if (latestForm?.kind !== 'application_form') return null;
  const { back, forward } = latestForm.navigation;
  if (!back?.visible && !forward?.visible) return null;

  const busy = loadingButton !== null || isClearingForm;
  const forwardAction: ApplicationAction =
    forward?.kind === 'submit' ? 'submit' : 'next';
  const handleAction = (action: ApplicationAction) => {
    if (!authConnected && onSignIn) {
      onSignIn();
      return;
    }
    onApplicationAction(action);
  };

  return (
    <div className='form-navigation-actions'>
      {back?.visible ? (
        <Button
          type='button'
          size='md'
          className='flex-1'
          disabled={!back.visible || !back.enabled || busy}
          isLoading={loadingButton === 'previous'}
          onClick={() => handleAction('previous')}
        >
          {back.label}
        </Button>
      ) : null}
      {forward?.visible ? (
        <Button
          type='button'
          size='md'
          className='flex-1'
          disabled={!forward.visible || !forward.enabled || busy}
          isLoading={loadingButton === forwardAction}
          onClick={() => handleAction(forwardAction)}
        >
          {forward.label}
        </Button>
      ) : null}
    </div>
  );
}
