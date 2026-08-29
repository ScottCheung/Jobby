/** @format */

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { showGlobalToast } from '@/lib/toast';
import { TailorQuickEntry } from './TailorQuickEntry';

export function AiStudioContent() {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);

  const handleStartGeneration = async (params: {
    docType: 'resume' | 'cover_letter' | 'both';
    jobTitle: string;
    company: string;
    jobDescription: string;
    mock?: boolean;
    careerProfileId?: string;
  }) => {
    setIsGenerating(true);

    try {
      const result = await api.reviewJob({
        job_description: params.jobDescription,
        title: params.jobTitle || undefined,
        company: params.company || undefined,
        doc_type: params.docType,
        mock: params.mock,
        career_profile_id: params.careerProfileId,
      });

      if (result.tailored_resume) {
        showGlobalToast('Tailored documents generated successfully!');
        const targetDocHash = params.docType === 'cover_letter' ? '#cl' : '#cv';
        router.push(`/ai-studio/resumes/tailor/${result.tailored_resume.id}${targetDocHash}`);
      } else {
        router.push('/ai-studio/resumes/tailor');
      }
    } catch (err) {
      showGlobalToast(
        err instanceof Error ? err.message : 'Generation failed, please try again.',
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className='w-full min-w-0 max-w-full px-2 sm:px-4 py-2'>
      <TailorQuickEntry
        onGenerationStart={handleStartGeneration}
        isGenerating={isGenerating}
      />
    </div>
  );
}
