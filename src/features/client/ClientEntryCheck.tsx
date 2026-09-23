import { useEffect, useRef } from 'react';
import { toast } from '@heroui/react';
import { useNavigate } from 'react-router-dom';
import { fetchClientProfile, hasActiveSavingsAccount, hasRequiredIdentityDocument, listKycDocuments } from '@/api/profile';

/** Mounted once per authenticated workspace, including restored sessions. */
export function ClientEntryCheck() {
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  // Check entry once; route changes must not restart onboarding or open a form.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const profile = await fetchClientProfile();
        if (cancelled) return;
        if (!hasActiveSavingsAccount(profile)) {
          navigateRef.current('/app/client/savings', { replace: true });
          return;
        }
        const documents = await listKycDocuments();
        if (cancelled) return;
        if (!hasRequiredIdentityDocument(documents)) {
          navigateRef.current('/app/client/documents', { replace: true });
          return;
        }
      } catch {
        if (cancelled) return;
        toast.warning('Vérification momentanément indisponible. Réessayez avec « Faire une demande de prêt ».');
      }
    })();
    return () => { cancelled = true; };
  }, []);
  return null;
}
