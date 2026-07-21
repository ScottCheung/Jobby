export function CommentSkeleton() {
  return (
    <div className='space-y-5 py-2'>
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className='flex gap-2.5'>
          <div className='h-9 w-9 shrink-0 rounded-full skeleton' />
          <div className='flex-1 space-y-2'>
            <div className='h-3 w-28 rounded skeleton' />
            <div className='h-3 w-full rounded skeleton' />
            <div className='h-3 w-2/3 rounded skeleton' />
          </div>
        </div>
      ))}
    </div>
  );
}
