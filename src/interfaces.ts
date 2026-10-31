import { SettingsManager } from '@/app-settings'
import { Router, RouteLocationNormalizedLoadedGeneric } from 'vue-router'

export interface IConfirmDialog {
    confirm(message: string): Promise<boolean>
}

export interface IAlertDialog {
    alert(message: string, options?: IAlertOptions): Promise<boolean>
    error(message: string): Promise<boolean>
}

/**
 * What the user chose when the vault was changed elsewhere
 */
export type ConflictResolution = 'reload' | 'keep-mine' | 'save-as'

export interface IConflictDialog {
    resolve(message: string): Promise<ConflictResolution | null>
    dismiss(): void
}

export interface INotifier {
    notify(message: string): void
}

export interface IAPISettings {
    appSettings: SettingsManager
    router: Router
    route: RouteLocationNormalizedLoadedGeneric
    confirmDialog?: IConfirmDialog
    alertDialog?: IAlertDialog
    conflictDialog?: IConflictDialog
    notifier?: INotifier
}

export interface ISaveProfileOptions {
    /** Overwrite the vault even if it was changed elsewhere */
    force?: boolean
    /** The profile references attachments */
    hasAttachments?: boolean
}

/**
 * Attachment metadata returned by the main process when files are added
 */
export interface IAttachmentData {
    id: string
    name: string
    size: number
    key: string
    added: string
}

export interface IAddAttachmentsResult {
    attachments: IAttachmentData[]
    errors: string[]
}

export interface IAlertOptions {
    icon?: string
    color?: string
    title?: string
}

/**
 * Represents a category either from vault or pre-defined like All or Starred
 */
export interface ICategoryDescriptor {
    name: string
    id: string
}
