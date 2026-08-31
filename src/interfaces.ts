import { SettingsManager } from '@/app-settings'
import { Router, RouteLocationNormalizedLoadedGeneric } from 'vue-router'

export interface IConfirmDialog {
    confirm(message: string): Promise<boolean>
}

export interface IAlertDialog {
    alert(message: string, options?: IAlertOptions): Promise<boolean>
    error(message: string): Promise<boolean>
}

export interface IAPISettings {
    appSettings: SettingsManager
    router: Router
    route: RouteLocationNormalizedLoadedGeneric
    confirmDialog?: IConfirmDialog
    alertDialog?: IAlertDialog
}

export interface IAlertOptions {
    icon?: string
    color?: string
    title?: string
}
