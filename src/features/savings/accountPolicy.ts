type Account = { account_type?: string; status?: string };

export function isSavingsAccount(account: Account) {
  const type = (account.account_type ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
  return [
    "EPARGNE",
    "SAVINGS",
    "SAVING",
    "SAVINGS_ACCOUNT",
    "COMPTE_EPARGNE",
  ].includes(type);
}

export function isActiveSavingsAccount(account: Account) {
  return (
    isSavingsAccount(account) && ["ACTIVE", "ACTIF"].includes((account.status ?? "").trim().toUpperCase())
  );
}
