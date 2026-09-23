import type { CommandId, WorkflowStatus } from './types';

export type WorkflowResult<
  TData,
  TStatus extends string = WorkflowStatus,
  TCommand extends CommandId = CommandId,
> = {
  command: TCommand;
  status: TStatus;
  data: TData;
};

export function workflowResult<
  TData,
  TStatus extends string,
  TCommand extends CommandId,
>(
  command: TCommand,
  status: TStatus,
  data: TData,
): WorkflowResult<TData, TStatus, TCommand> {
  return { command, status, data };
}
