export type CommandId = 'MON_SOLDE' | 'DEMANDER_CREDIT';

export type CommandCode = 'A' | 'D';

export type CommandIdentity = {
  A: 'MON_SOLDE';
  D: 'DEMANDER_CREDIT';
};

export type WorkflowStatus =
  | 'UNAUTHENTICATED'
  | 'PROFILE_UNAVAILABLE'
  | 'NO_ACTIVE_SAVINGS'
  | 'BALANCE_MISSING'
  | 'READY';

export type SavingsBalanceAccount = {
  id?: number;
  accountNumber?: string;
  balance: number | null;
};

export type BalanceData = {
  accounts: SavingsBalanceAccount[];
};
