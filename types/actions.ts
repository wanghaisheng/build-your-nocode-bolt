export type ActionType = 'file' | 'shell' | 'start';

export interface BaseAction {
  content: string;
}

export interface FileAction extends BaseAction {
  type: 'file';
  filePath: string;
}

export interface ShellAction extends BaseAction {
  type: 'shell';
}

export interface StartAction extends BaseAction {
  type: 'start';
}

export type BoltNextAction = FileAction | ShellAction | StartAction ;

export type BoltNextActionData = BoltNextAction | BaseAction;
