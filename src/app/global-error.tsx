'use client';

import NextError from 'next/error';
import { useEffect } from 'react';
import { clientLogger } from '@/lib/client-logger';

export default function GlobalError({
  error
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    // Логируем ошибку через client-logger
    clientLogger.error(
      error.message || 'Unknown error',
      {
        digest: error.digest,
        name: error.name
      },
      error.stack,
      'global-error-boundary'
    );
  }, [error]);

  return (
    <html>
      <body>
        {/* `NextError` is the default Next.js error page component. Its type
        definition requires a `statusCode` prop. However, since the App Router
        does not expose status codes for errors, we simply pass 0 to render a
        generic error message. */}
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
