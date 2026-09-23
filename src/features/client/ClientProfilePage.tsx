import { Screen } from '@/shared/ui/Screen';
import { BorrowerProfileForm } from './BorrowerProfileForm';
import { Link } from 'react-router-dom';

export function ClientProfilePage() {
  return (
    <Screen viewId="view-client-profile">
      <p>Pour compléter votre profil CreditFast, déposez une pièce d’identité (CNI, NINA ou passeport). <Link to="/app/client/documents">Compléter mes pièces obligatoires</Link></p>
      <BorrowerProfileForm />
    </Screen>
  );
}
