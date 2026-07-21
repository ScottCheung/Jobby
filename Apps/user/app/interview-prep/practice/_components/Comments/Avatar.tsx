import { cn } from '@/lib/utils';
import { initials } from './utils';

export function Avatar({
  name,
  url,
  small = false,
  ring,
}: {
  name: string;
  url?: string | null;
  small?: boolean;
  ring?: 'author' | 'admin';
}) {
  return (
    <div
      className={cn(
        'shrink-0 rounded-full',
        ring === 'admin' &&
          'ring-2 ring-rose-400/70 ring-offset-2 ring-offset-panel',
        ring === 'author' &&
          'ring-2 ring-primary/50 ring-offset-2 ring-offset-panel',
      )}
    >
      <div
        className={cn(
          'flex items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-primary/25 to-primary/10 font-extrabold text-primary',
          small ? 'h-7 w-7 text-[9px]' : 'h-9 w-9 text-[11px]',
        )}
      >
        {url ?
          <img src={url} alt='' className='h-full w-full object-cover' />
        : initials(name)}
      </div>
    </div>
  );
}
