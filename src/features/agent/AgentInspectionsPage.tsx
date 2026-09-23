import { Screen } from '@/shared/ui/Screen';
import { PageHeader } from '@/shared/ui/PageHeader';
import { StatCard } from '@/shared/ui/StatCard';
import { AppTable } from '@/shared/ui/AppTable';
import { DossierBrowser } from '@/shared/ui/DossierBrowser';
import { callApp } from '@/shared/ui/legacy';
import { guaranteeStatusLabel, guaranteeTypeLabel } from '@/api/credit';
import { borrowerName, formatFcfa } from '@/features/workflow/workflow';
import { useAgentWorkspace } from './useAgentWorkspace';
import { Link } from 'react-router-dom';

export function AgentInspectionsPage() {
  const { guarantees, pendingGuarantees } = useAgentWorkspace();
  const verified = guarantees.filter((row) => (row.guarantee.verification_status || '').toUpperCase() === 'VERIFIED');
  const rejected = guarantees.filter((row) => (row.guarantee.verification_status || '').toUpperCase() === 'REJECTED');
  const verifiedValue = verified.reduce((sum, row) => sum + (row.guarantee.verified_value ?? row.guarantee.declared_value ?? 0), 0);

  return (
    <Screen viewId="view-agent-inspections">
      <PageHeader title="Contrôle terrain des garanties" crumbs={['Espace agent', 'Visite et validation']} actions={<Link className="btn btn-primary" to="/app/agent/field-visits">Planning et rapports de visite</Link>} />

      <div className="grid-4" style={{ marginBottom: '1.5rem' }}>
        <StatCard tone="amber" icon="fa-clipboard-check" value={String(pendingGuarantees.length)} label="À examiner sur le terrain" trend={<>Contrôle non encore validé</>} />
        <StatCard tone="emerald" icon="fa-shield-halved" value={verified.length ? formatFcfa(verifiedValue) : '—'} label="Valeur retenue" trend={<>Garanties déjà contrôlées</>} />
        <StatCard tone="primary" icon="fa-list" value={String(guarantees.length)} label="Garanties déclarées" trend={<>Sur les dossiers de la file</>} />
        <StatCard tone="rose" icon="fa-ban" value={String(rejected.length)} label="Refusées" trend={<>Non retenues après visite</>} />
      </div>

      <DossierBrowser
        heading="Garanties"
        items={guarantees.map((row) => ({
          id: String(row.guarantee.id),
          title: borrowerName(row.request),
          meta: `${guaranteeTypeLabel(row.guarantee.guarantee_type)} · ${guaranteeStatusLabel(row.guarantee.verification_status)}`,
          hint: formatFcfa(row.guarantee.declared_value),
        }))}
        onOpen={(id) => callApp('openInspectionDrawer', id)}
        listView={
          guarantees.length ? (
            <AppTable
              chrome="plain"
              title="Garanties"
              items={guarantees.map((row) => ({
                id: String(row.guarantee.id),
                requestId: row.request.id,
                name: borrowerName(row.request),
                type: guaranteeTypeLabel(row.guarantee.guarantee_type),
                status: guaranteeStatusLabel(row.guarantee.verification_status),
                declared: formatFcfa(row.guarantee.declared_value),
                verified: formatFcfa(row.guarantee.verified_value),
                purpose: row.request.purpose || '',
              }))}
              columns={[
                { id: 'name', label: 'Emprunteur', isRowHeader: true, render: (row) => row.name },
                { id: 'type', label: 'Type', render: (row) => row.type },
                { id: 'declared', label: 'Valeur déclarée', render: (row) => row.declared },
                { id: 'verified', label: 'Valeur retenue', render: (row) => row.verified },
                { id: 'status', label: 'Contrôle', render: (row) => row.status },
              ]}
              onRowAction={(key) => callApp('openInspectionDrawer', String(key))}
            />
          ) : (
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.86rem' }}>Aucune garantie en base pour les dossiers de cette file.</p>
          )
        }
      />
    </Screen>
  );
}
