import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const specPath = process.argv[2] ?? 'docs/api-audit-openapi.json';
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
function files(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(path.join(dir, entry.name)) : /\.tsx?$/.test(entry.name) ? [path.join(dir, entry.name).replaceAll('\\', '/')] : []); }
const sources = files('src').map(file => ({ file, source: ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true) }));
const calls = [];
const usages = new Map();
const normalize = value => value.replace(/^\/api(?=\/)/, '').split('?')[0].replace(/\{[^}]*\}/g, '{}');
function literal(node) {
  if (!node) return [];
  if (ts.isStringLiteralLike(node)) return [node.text];
  if (ts.isConditionalExpression(node)) return [...literal(node.whenTrue), ...literal(node.whenFalse)];
  if (ts.isTemplateExpression(node)) return [node.head.text + node.templateSpans.map(span => '{}' + span.literal.text).join('')];
  return [];
}
for (const { file, source } of sources) {
  function visit(node) {
    if (ts.isCallExpression(node)) {
      const name = node.expression.getText(source);
      const at = { file, line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1 };
      usages.set(name, [...(usages.get(name) ?? []), at]);
      if (['apiJson', 'apiBlob', 'listPaged', 'postLogin'].includes(name)) {
        let parent = node.parent;
        while (parent && !ts.isFunctionDeclaration(parent)) parent = parent.parent;
        const fn = parent?.name?.text ?? '(composant)';
        const options = node.arguments[1];
        const method = options && ts.isObjectLiteralExpression(options) ? options.properties.find(prop => prop.name?.getText(source) === 'method') : undefined;
        let methods = method && ts.isPropertyAssignment(method) ? literal(method.initializer) : [name === 'postLogin' ? 'POST' : 'GET'];
        let paths = literal(node.arguments[0]);
        if (fn === 'createMembership') paths = ['/profile/savings-membership', '/profile/savings-membership/{}/resubmit'];
        if (fn === 'listPendingMemberships') paths = ['/admin/savings-memberships'];
        if (fn === 'updateCreditGuarantee' && methods.includes('POST')) methods = ['PUT']; // multipart _method=PUT
        for (const route of paths.filter(value => value.startsWith('/'))) for (const method of methods) calls.push({ ...at, fn, method, path: normalize(route), transport: name });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
const endpoints = [];
for (const [route, operations] of Object.entries(spec.paths)) for (const [method, operation] of Object.entries(operations)) {
  if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;
  const matches = calls.filter(call => call.method === method.toUpperCase() && call.path === normalize(route));
  for (const match of matches) match.usages = usages.get(match.fn) ?? [];
  endpoints.push({ method: method.toUpperCase(), path: route, summary: operation.summary, tags: operation.tags, matches });
}
const extra = calls.filter(call => !endpoints.some(endpoint => endpoint.method === call.method && normalize(endpoint.path) === call.path));
fs.mkdirSync('docs', { recursive: true });
fs.writeFileSync('tmp/api-audit-inventory.json', JSON.stringify({ endpoints, extra }, null, 2));
console.log(JSON.stringify({ documented: endpoints.length, matched: endpoints.filter(row => row.matches.length).length, missing: endpoints.filter(row => !row.matches.length).map(row => `${row.method} ${row.path}`), unused: endpoints.filter(row => row.matches.length && row.matches.every(match => !match.usages.length)).map(row => ({ endpoint: `${row.method} ${row.path}`, fn: row.matches.map(match => match.fn) })), extra }, null, 2));

const notes = new Map();
function note(method, route, message) { notes.set(`${method} ${normalize(route)}`, message); }
note('POST', '/auth/client/login', 'F03 — Mot de passe modifié par trim(); les erreurs 422 sont reformulées comme identifiants incorrects.');
note('POST', '/auth/staff/login', 'F03 — trim() du mot de passe ; toute erreur API est reformulée comme e-mail non reconnu, même un 429/500.');
note('POST', '/admin/scoring-models', 'F08 — COLD_START proposé par l’écran, alors que le schéma ScoringMode accepte seulement STANDARD.');
note('POST', '/admin/scoring-models/{}/rules', 'F09 — activity_vitality absent du sélecteur ; min_score, max_score, rule_config, priority et status non exposés. Champs facultatifs : couverture partielle, pas une preuve de rejet serveur.');
note('GET', '/admin/audit-logs', 'F06 — Pagination non parcourue ; aussi appelé depuis les espaces analyste/comité malgré le rôle admin uniquement.');
note('PUT', '/profile', 'F07 — Champs société absents du payload typé et des écrans de modification ; contacts modifiés localement sans persistance par cette route.');
note('GET', '/agent/clients/{}/kyc', 'F05 — Toute erreur réseau/API est convertie en liste vide, indistinguable de l’absence de pièces.');
note('GET', '/credit-products', 'F10 — En cas d’erreur ou de catalogue vide, le formulaire affiche tout le catalogue statique, sans filtrage personne physique/morale.');
note('POST', '/credit-requests', 'F02 — Route client seulement mais bouton de création également présent côté agent ; le précontrôle utilise /profile (client seulement).');
note('POST', '/credit-requests/{}/submit', 'F02 — Précontrôle /profile imposé à tous les appelants ; incompatible avec les rôles chargé/admin autorisés par cette route. Parcours client raccordé.');
note('GET', '/credit-requests/{}/analysis', 'F04 — Le helper de lecture déclenche POST /score sur toute erreur, pas seulement une analyse absente.');
note('POST', '/credit-requests/{}/score', 'F04 — Fallback aussi utilisé par le comité, qui ne figure pas parmi les rôles autorisés au calcul.');
note('POST', '/agent/clients/{}/financial-accounts', 'F11 — Envoi PENDING raccordé ; activation dépend des nouvelles routes admin non documentées. Validation serveur de PENDING à confirmer.');
note('GET', '/notifications', 'F12 — Première page seulement et 12 éléments affichés ; absence de navigation vers les plus anciens. Type FIELD_VISIT sans libellé/lien spécialisé.');
note('PUT', '/credit-requests/{}/guarantees/{}', 'F13 — JSON PUT présent ; remplacement fichier via POST + _method=PUT. Convention à vérifier sur serveur, non explicitée par Swagger.');
note('POST', '/simulations/installments', 'F09 — Scénarios/revenus/charges/dette raccordés ; other_income documenté mais absent du type d’entrée frontend.');
for (const route of ['/credit-requests', '/agent/requests', '/analyst/requests', '/committee/requests', '/loans', '/agent/clients']) note('GET', route, 'F14 — Pagination parcourue mais limitée silencieusement à 20 pages (per_page=100).');
note('GET', '/admin/users', 'F14 — Pagination parcourue mais limitée silencieusement à 50 pages (per_page=100).');

const cell = value => String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');
const link = ref => `[${ref.file}:${ref.line}](../${ref.file}#L${ref.line})`;
function status(row) {
  if (!row.matches.length) return 'Absent du frontend';
  if (notes.has(`${row.method} ${normalize(row.path)}`)) return 'Partiel / à corriger';
  if (row.matches.every(match => !match.usages.length)) return 'Adaptateur inutilisé';
  return 'Raccordé — aucun écart relevé';
}
const counts = Object.fromEntries([...new Set(endpoints.map(status))].map(label => [label, endpoints.filter(row => status(row) === label).length]));
let md = `# Audit des endpoints CreditFast — 22 septembre 2026\n\n`;
md += `Source : [documentation Swagger](https://creditfast-api.onrender.com/api/documentation), [schéma téléchargé](https://creditfast-api.onrender.com/docs?api-docs.json), [copie auditée](api-audit-openapi.json).\n\n`;
md += `## Périmètre et niveau de preuve\n\nAudit du code présent dans src/ et recherche complémentaire dans public/js/. Correspondance méthode + chemin, fonctions appelantes, formulaires, champs, rôles et gestion des réponses/erreurs. Les paramètres d’URL sont normalisés ; la mise à jour multipart des garanties est comptée comme PUT via _method. Aucun compte de test connecté n’a été utilisé et aucune écriture réelle n’a été exécutée. « Raccordé » ne signifie pas « validé en production ». Les limites ci-dessous sont des écarts de code/contrat ; les routes absentes de Swagger ne sont pas déclarées inexistantes sur le serveur.\n\n`;
md += `## Résultat\n\n93 opérations documentées ; 85 ont un appel frontend correspondant, dont 83 avec un appelant détecté et 2 adaptateurs sans appelant. 8 opérations documentées sont absentes. 8 autres appels frontend concernent des routes épargne non documentées.\n\n| Classement | Opérations |\n|---|---:|\n`;
for (const [label, count] of Object.entries(counts)) md += `| ${label} | ${count} |\n`;
md += `\nLes catégories sont exclusives. Un endpoint marqué partiel peut fonctionner dans certains parcours. Les champs facultatifs non exposés et les plafonds de pagination ne sont pas des erreurs bloquantes sur tous les dossiers.\n\n`;
md += `## Constats et corrections à prioriser\n\n`;
const findings = [
  ['F01 — Visites terrain absentes', 'Les 8 routes field-visits existent dans le contrat mais aucun appel frontend ne les utilise. AgentInspectionsPage repose sur les garanties. saveInspectionReport ne transmet que verification_status et verified_value à /agent/guarantees/{id}/verify, pas un rapport de visite. Ajouter modèle, API, liste, planning, détail, démarrage, clôture, annulation/no-show et notifications FIELD_VISIT.', 'src/features/agent/fillAgentDrawers.ts', 1441],
  ['F02 — Rôles de création/soumission de crédit', 'submitCreditRequest appelle requireActiveSavingsAccount, qui consulte /profile réservé au client. Le contrôle ne doit pas utiliser le profil du staff pour le compte du demandeur. Les boutons « nouvelle demande » côté agent ouvrent par ailleurs un parcours dont POST /credit-requests est réservé au client. Prévoir un parcours staff autorisé par le backend ou limiter ces actions.', 'src/api/credit.ts', 247],
  ['F03 — Connexion et erreurs', 'Ne pas supprimer les espaces du mot de passe : ils peuvent faire partie du secret. Préserver la distinction entre identifiants incorrects, validation, limitation de débit et panne serveur. Le comportement trim() a été reproduit hors réseau.', 'src/api/auth.ts', 81],
  ['F04 — Lecture du score avec effet de bord', 'loadCreditAnalysis relance POST /score après toute erreur de lecture (403, réseau, etc.). Ce helper est aussi appelé côté comité, non autorisé au calcul. Distinguer lecture et calcul explicite ; ne pas recalculer sur refus d’accès ou panne. Le fallback après 403 a été reproduit hors réseau.', 'src/api/credit.ts', 566],
  ['F05 — Échec KYC masqué', 'listAgentClientKycDocuments capture toute erreur et retourne []. L’interface peut donc annoncer une absence de pièces alors que la lecture a échoué. Afficher un état d’échec avec reprise. Comportement reproduit hors réseau.', 'src/api/agent.ts', 157],
  ['F06 — Journal d’audit incomplet / rôles', 'GET /admin/audit-logs est paginé, mais une seule requête est faite. AuditLogsPage l’appelle aussi depuis analyste/comité alors que Swagger autorise admin uniquement ; l’écran affiche alors une indisponibilité. Ajouter pagination et aligner les accès.', 'src/api/admin.ts', 289],
  ['F07 — Modification du profil partielle', 'PUT /profile supporte les informations société, non proposées dans UpdateClientProfilePayload. EditProfileModal peut aussi actualiser email/phone dans la session alors que le payload client ne les sauvegarde pas ; les rendre non éditables ou prévoir une route autorisée avant d’annoncer la sauvegarde.', 'src/features/modals/EditProfileModal.tsx', 245],
  ['F08 — Mode de scoring retiré', 'Le schéma actuel accepte uniquement STANDARD et indique explicitement le retrait du Cold Start. AdminScoringPage propose encore COLD_START. Retirer cette option et aligner les types/anciens textes du parcours.', 'src/features/admin/AdminScoringPage.tsx', 162],
  ['F09 — Champs facultatifs non exposés', 'Règles de scoring : facteur activity_vitality et paramètres avancés absents. Simulation : other_income absent du payload typé. À compléter si ces capacités doivent être accessibles ; les champs obligatoires sont présents.', 'src/api/admin.ts', 294],
  ['F10 — Catalogue de secours non filtré', 'Si /credit-products échoue ou renvoie une liste vide, LoanApplicationModal propose la totalité des types statiques. Risque de choix incompatible avec le type de demandeur et de rejet à la création. Garder un état d’erreur/reprise ou filtrer avec une source fiable.', 'src/features/modals/LoanApplicationModal.tsx', 12],
  ['F11 — Comptes en attente sans activation documentée', 'La saisie agent utilise une route existante et envoie PENDING. La validation repose sur des routes admin préparées mais absentes du Swagger actuel. Le parcours complet dépend du contrat savings-api.md ; ne pas le classer opérationnel de bout en bout.', 'src/features/agent/AgentClientSheet.tsx', 145],
  ['F12 — Notifications partielles', 'Le serveur documente une liste paginée. Le frontend ne charge que la première page et en affiche 12. FIELD_VISIT est documenté mais n’a pas de libellé ni de lien dédié. Les nouveaux types SAVINGS_MEMBERSHIP_* attendent leur émission par le backend.', 'src/features/workflow/NotificationBell.tsx', 26],
  ['F13 — Multipart à valider en intégration', 'PUT garantie avec fichier utilise POST et _method=PUT. Le test hors réseau confirme cette émission, mais Swagger ne documente que PUT JSON/multipart. Vérifier la convention serveur avant de déclarer le remplacement de fichier entièrement validé.', 'src/api/credit.ts', 431],
  ['F14 — Plafonds de pagination', 'Dossiers, clients et prêts : maximum 20 pages ; utilisateurs : 50 pages. La troncature n’est pas annoncée. Prévoir une pagination UI ou signaler la limite ; tester des réponses multi-pages.', 'src/api/credit.ts', 206],
  ['Hors inventaire — Rendez-vous client simulé', 'handleBookAppointmentModal dans le legacy affiche « Rendez-vous confirmé » et « SMS de rappel envoyé » sans requête réseau. Les nouvelles routes field-visits sont réservées agent/admin, elles ne suffisent pas à autoriser directement une réservation client. Ne pas présenter une réservation comme persistée sans route client ou workflow staff.', 'public/js/app.js', 7606],
];
for (const [title, detail, file, line] of findings) md += `### ${title}\n\n${detail}\n\nPreuve : ${link({ file, line })}.\n\n`;
md += `## Inventaire endpoint par endpoint\n\nLe préfixe /api est celui de la documentation. Les appels frontend utilisent VITE_API_URL comme base. Les références « appels » peuvent être des helpers intermédiaires ; elles constituent une preuve de raccordement statique, pas un test de navigation dans chaque écran.\n\n`;
for (const tag of [...new Set(endpoints.flatMap(row => row.tags ?? ['Autre']))]) {
  md += `### ${tag}\n\n| Méthode et endpoint | État | Implémentation / appelant | Vérification ou reste à faire |\n|---|---|---|---|\n`;
  for (const row of endpoints.filter(row => (row.tags ?? ['Autre']).includes(tag))) {
    const first = row.matches[0];
    const refs = first ? `${link(first)} — ${first.fn}; appels : ${(first.usages ?? []).slice(0, 2).map(link).join(', ') || 'aucun'}` : '—';
    const detail = notes.get(`${row.method} ${normalize(row.path)}`) ?? (!first ? 'F01 — À implémenter côté frontend.' : !first.usages.length ? 'Fonction présente mais non appelée. Le détail est actuellement issu des listes ; décider si une relecture serveur est nécessaire.' : 'Méthode/chemin et raccordement repérés ; aucun écart spécifique relevé dans cet audit. Recette authentifiée à effectuer.');
    md += `| \`${row.method} ${row.path}\` | ${status(row)} | ${refs} | ${cell(detail)} |\n`;
  }
  md += '\n';
}
md += `## Routes frontend non présentes dans le Swagger actuel\n\nNe pas les confondre avec des endpoints existants non implémentés : il s’agit du contrat épargne préparé pour le binôme backend. Voir [savings-api.md](savings-api.md).\n\n| Appel | Source | État |\n|---|---|---|\n`;
for (const row of extra) md += `| \`${row.method} /api${row.path}\` | ${link(row)} | Non documenté ; intégration réelle à confirmer |\n`;
md += `\n## Vérifications exécutées et recette restante\n\n- Inventaire TypeScript AST : 93 opérations rapprochées par méthode/chemin ; inspection manuelle des formulaires, rôles, payloads et erreurs pour les écarts listés.\n- scripts/test-api-audit.mjs : 10 contrôles hors réseau, dont 7 vérifications d’adaptateurs et 3 reproductions d’anomalies (F03, F04, F05). Le succès des tests de caractérisation signifie que les anomalies sont reproduites, pas corrigées.\n- Aucun appel de mutation au serveur, aucun test avec identifiants réels. Les routes protégées, la persistance des fichiers, le multipart PUT, les droits par rôle et les transitions restent à tester en environnement de recette.\n\nÀ tester avec client PP, client PM, chargé, analyste, comité et admin : création/reprise de dossier, documents et garanties, KYC, transmission, analyse, décision, décaissement et remboursement ; 401/403/404/409/422/429/500, perte réseau, pagination et double soumission.\n\nReproduction : node scripts/audit-api.mjs [chemin-du-schema.json], puis node scripts/test-api-audit.mjs. Le script d’inventaire conserve des annotations de revue manuelle : les revalider après toute correction du code.\n`;
fs.writeFileSync('docs/api-audit.md', md);
console.log('Audit report:', counts);
