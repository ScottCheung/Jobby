/** @format */

'use client';

import { useParams } from 'next/navigation';
import { AiStudioContent } from '../../_components/ai-studio-content';

export default function TailoredResumeDetailPage() {
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : undefined;

  return <AiStudioContent targetId={id} />;
}
