import React from 'react';

export default function PageContainer({
  children,
  scrollable = true
}: {
  children: React.ReactNode;
  scrollable?: boolean;
}) {
  // scrollable parameter is currently not used but kept for future compatibility
  return (
    <div className='flex w-full min-w-0 flex-1 flex-col p-4 md:px-6'>
      {children}
    </div>
  );
}
