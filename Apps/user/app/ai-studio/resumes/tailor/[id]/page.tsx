/** @format */

'use client';

import { useParams } from 'next/navigation';
import { TailoredResumeStudio } from '../../../_components/tailored-resume-studio';

export default function TailoredResumeDetailPage() {
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : undefined;

  return <TailoredResumeStudio targetId={id} />;
}
