'use client';

import { useState, useEffect, useRef } from 'react';
import { OnboardingWizard } from './onboarding-wizard';

const STORAGE_KEY = 'sai:onboarding:completed';

interface Props {
  projectCount: number;
}

export function WorkspaceOnboarding({ projectCount }: Props) {
  const [open, setOpen] = useState(false);
  const checkedRef = useRef(false);

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;
    if (typeof window === 'undefined') return;
    const completed = window.localStorage.getItem(STORAGE_KEY);
    if (!completed && projectCount === 0) {
      setOpen(true);
    }
  }, [projectCount]);

  const handleComplete = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, 'true');
    }
    setOpen(false);
  };

  return (
    <OnboardingWizard
      open={open}
      onClose={handleComplete}
      onComplete={handleComplete}
    />
  );
}
