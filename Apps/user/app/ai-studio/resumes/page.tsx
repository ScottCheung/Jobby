/** @format */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AiStudioResumesRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/ai-studio/resumes/master');
  }, [router]);

  return null;
}
