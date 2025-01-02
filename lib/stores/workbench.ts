'use client';

import { atom, map, type MapStore, type ReadableAtom, type WritableAtom } from 'nanostores';
import type { EditorDocument, ScrollPosition } from '@/components/editor/codemirror/CodeMirrorEditor';
import { ActionRunner } from '@/lib/runtime/action-runner';
import type { ActionCallbackData, ArtifactCallbackData } from '@/lib/runtime/message-parser';
import { webcontainer } from '@/lib/webcontainer';
import type { ITerminal } from '@/types/terminal';
import { unreachable } from '@/utils/unreachable';
import { EditorStore } from './editor';
import { FilesStore, type FileMap } from './files';
import { PreviewsStore } from './previews';
import { TerminalStore } from './terminal';

export interface ArtifactState {
  id: string;
  title: string;
  closed: boolean;
  runner: ActionRunner;
}

export type ArtifactUpdateState = Pick<ArtifactState, 'title' | 'closed'>;

type Artifacts = MapStore<Record<string, ArtifactState>>;

export type WorkbenchViewType = 'editor' | 'preview';

export class WorkbenchStore {
  private previewsStore = new PreviewsStore(webcontainer);
  private filesStore = new FilesStore(webcontainer);
  private editorStore = new EditorStore(this.filesStore);
  private terminalStore = new TerminalStore(webcontainer);

  artifacts: Artifacts = map({});
  showWorkbench: WritableAtom<boolean> = atom(false);
  currentView: WritableAtom<WorkbenchViewType> = atom('editor');
  unsavedFiles: WritableAtom<Set<string>> = atom(new Set<string>());
  modifiedFiles = new Set<string>();
  artifactIdList: string[] = [];

  constructor() {
    if (process.env.NODE_ENV === 'development') {
      this.setupHotReload();
    }
  }

  private setupHotReload() {
    if (typeof window !== 'undefined') {
      // Store state in window for hot reloading
      (window as any).__WORKBENCH_STATE__ = {
        artifacts: this.artifacts,
        unsavedFiles: this.unsavedFiles,
        showWorkbench: this.showWorkbench,
        currentView: this.currentView,
      };
    }
  }

  get previews() {
    return this.previewsStore.previews;
  }

  get files() {
    return this.filesStore.files;
  }

  get currentDocument(): ReadableAtom<EditorDocument | undefined> {
    return this.editorStore.currentDocument;
  }

  get selectedFile(): ReadableAtom<string | undefined> {
    return this.editorStore.selectedFile;
  }

  get firstArtifact(): ArtifactState | undefined {
    return this.getArtifact(this.artifactIdList[0]);
  }

  get filesCount(): number {
    return this.filesStore.filesCount;
  }

  get showTerminal() {
    return this.terminalStore.showTerminal;
  }
  get boltnextTerminal() {
    return this.terminalStore.boltnextTerminal;
  }

  toggleTerminal(value?: boolean) {
    this.terminalStore.toggleTerminal(value);
  }

  attachTerminal(terminal: ITerminal) {
    this.terminalStore.attachTerminal(terminal);
  }

  attachBoltNextTerminal(terminal: ITerminal) {
    this.terminalStore.attachBoltNextTerminal(terminal);
  }

  onTerminalResize(cols: number, rows: number) {
    this.terminalStore.onTerminalResize(cols, rows);
  }

  setDocuments(files: FileMap) {
    this.editorStore.setDocuments(files);

    if (this.filesStore.filesCount > 0 && this.currentDocument.get() === undefined) {
      // we find the first file and select it
      for (const [filePath, dirent] of Object.entries(files)) {
        if (dirent?.type === 'file') {
          this.setSelectedFile(filePath);
          break;
        }
      }
    }
  }

  setShowWorkbench(show: boolean) {
    this.showWorkbench.set(show);
  }

  setCurrentDocumentContent(newContent: string) {
    const filePath = this.currentDocument.get()?.filePath;

    if (!filePath) {
      return;
    }

    const originalContent = this.filesStore.getFile(filePath)?.content;
    const unsavedChanges = originalContent !== undefined && originalContent !== newContent;

    this.editorStore.updateFile(filePath, newContent);

    const currentDocument = this.currentDocument.get();

    if (currentDocument) {
      const previousUnsavedFiles = this.unsavedFiles.get();

      if (unsavedChanges && previousUnsavedFiles.has(currentDocument.filePath)) {
        return;
      }

      const newUnsavedFiles = new Set(previousUnsavedFiles);

      if (unsavedChanges) {
        newUnsavedFiles.add(currentDocument.filePath);
      } else {
        newUnsavedFiles.delete(currentDocument.filePath);
      }

      this.unsavedFiles.set(newUnsavedFiles);
    }
  }

  setCurrentDocumentScrollPosition(position: ScrollPosition) {
    const editorDocument = this.currentDocument.get();

    if (!editorDocument) {
      return;
    }

    const { filePath } = editorDocument;

    this.editorStore.updateScrollPosition(filePath, position);
  }

  setSelectedFile(filePath: string | undefined) {
    this.editorStore.setSelectedFile(filePath);
  }

  async saveFile(filePath: string) {
    const documents = this.editorStore.documents.get();
    const document = documents[filePath];

    if (document === undefined) {
      return;
    }

    await this.filesStore.saveFile(filePath, document.value);

    const newUnsavedFiles = new Set(this.unsavedFiles.get());
    newUnsavedFiles.delete(filePath);

    this.unsavedFiles.set(newUnsavedFiles);
  }

  async saveCurrentDocument() {
    const currentDocument = this.currentDocument.get();

    if (currentDocument === undefined) {
      return;
    }

    await this.saveFile(currentDocument.filePath);
  }

  resetCurrentDocument() {
    const currentDocument = this.currentDocument.get();

    if (currentDocument === undefined) {
      return;
    }

    const { filePath } = currentDocument;
    const file = this.filesStore.getFile(filePath);

    if (!file) {
      return;
    }

    this.setCurrentDocumentContent(file.content);
  }

  async saveAllFiles() {
    for (const filePath of this.unsavedFiles.get()) {
      await this.saveFile(filePath);
    }
  }

  getFileModifcations() {
    return this.filesStore.getFileModifications();
  }

  resetAllFileModifications() {
    this.filesStore.resetFileModifications();
  }

  abortAllActions() {
    // TODO: implement abort all actions
  }

  addArtifact({ messageId, title, id }: ArtifactCallbackData) {
    const artifact = this.getArtifact(messageId);

    if (artifact) {
      return;
    }

    if (!this.artifactIdList.includes(messageId)) {
      this.artifactIdList.push(messageId);
    }

    this.artifacts.setKey(messageId, {
      id,
      title,
      closed: false,
      runner: new ActionRunner(webcontainer, () => this.boltnextTerminal),
    });
  }

  updateArtifact({ messageId }: ArtifactCallbackData, state: Partial<ArtifactUpdateState>) {
    const artifact = this.getArtifact(messageId);

    if (!artifact) {
      return;
    }

    this.artifacts.setKey(messageId, { ...artifact, ...state });
  }

  async addAction(data: ActionCallbackData) {
    const { messageId } = data;

    const artifact = this.getArtifact(messageId);

    if (!artifact) {
      unreachable('Artifact not found');
    }

    artifact.runner.addAction(data);
  }

  async runAction(data: ActionCallbackData) {
    const { messageId } = data;

    const artifact = this.getArtifact(messageId);

    if (!artifact) {
      unreachable('Artifact not found');
    }

    artifact.runner.runAction(data);
  }

  private getArtifact(id: string) {
    const artifacts = this.artifacts.get();
    return artifacts[id];
  }
}

// Create a singleton instance
let workbenchStoreInstance: WorkbenchStore | null = null;

export function getWorkbenchStore(): WorkbenchStore {
  if (!workbenchStoreInstance) {
    workbenchStoreInstance = new WorkbenchStore();
  }
  return workbenchStoreInstance;
}

export const workbenchStore = getWorkbenchStore();