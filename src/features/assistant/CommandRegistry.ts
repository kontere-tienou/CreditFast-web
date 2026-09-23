import { runBalanceWorkflow } from './workflows/balance.workflow';
import { runCreditWorkflow } from './workflows/credit.workflow';
import type { CommandCode, CommandIdentity } from './types';

export type RegisteredCommand<TCode extends CommandCode, TResult> = {
  code: TCode;
  id: CommandIdentity[TCode];
  run: () => Promise<TResult>;
};

const commands = {
  A: { code: 'A', id: 'MON_SOLDE', run: runBalanceWorkflow },
  D: { code: 'D', id: 'DEMANDER_CREDIT', run: runCreditWorkflow },
} satisfies { [TCode in CommandCode]: RegisteredCommand<TCode, unknown> };

type CommandMap = typeof commands;

export type CommandResultOf<TCode extends CommandCode> = Awaited<
  ReturnType<CommandMap[TCode]['run']>
>;

export type AnyRegisteredCommand = {
  [TCode in CommandCode]: RegisteredCommand<TCode, CommandResultOf<TCode>>;
}[CommandCode];

function isCommandCode(value: string): value is CommandCode {
  return Object.hasOwn(commands, value);
}

export function resolveCommand(input: string): AnyRegisteredCommand | null {
  const code = input.trim().toUpperCase();
  if (!isCommandCode(code)) {
    return null;
  }
  return commands[code];
}

export function executeCommand(input: string): Promise<CommandResultOf<CommandCode>> | null {
  return resolveCommand(input)?.run() ?? null;
}
