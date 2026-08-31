import { describe, it, expect } from 'vitest'
import { SettingsManager } from '@/app-settings'

describe('SettingsManager', () => {
    it('uses default values when no data is provided', () => {
        const settings = new SettingsManager()
        expect(settings.lightMode.value).toBe(false)
        expect(settings.enableTimeout.value).toBe(false)
        expect(settings.timeoutInSeconds.value).toBeUndefined()
        expect(settings.lastWorkingDirectory).toBeUndefined()
    })

    it('applies data from the constructor', () => {
        const settings = new SettingsManager({
            lightMode: true,
            enableTimeout: true,
            timeoutInSeconds: 120,
            lastWorkingDirectory: '/home/user'
        })
        expect(settings.lightMode.value).toBe(true)
        expect(settings.enableTimeout.value).toBe(true)
        expect(settings.timeoutInSeconds.value).toBe(120)
        expect(settings.lastWorkingDirectory).toBe('/home/user')
    })

    it('serializes settings to a JSON string that can be parsed back', () => {
        const settings = new SettingsManager({
            lightMode: true,
            enableTimeout: true,
            timeoutInSeconds: 60,
            lastWorkingDirectory: 'C:\\Users\\Eric'
        })

        const serialized = settings.toString()
        const parsed = JSON.parse(serialized)

        expect(parsed).toEqual({
            lightMode: true,
            enableTimeout: true,
            timeoutInSeconds: 60,
            lastWorkingDirectory: 'C:\\Users\\Eric'
        })
    })

    it('omits undefined properties when serializing', () => {
        const settings = new SettingsManager()
        const parsed = JSON.parse(settings.toString())

        expect(parsed).toEqual({
            lightMode: false,
            enableTimeout: false,
            lastWorkingDirectory: undefined
        })
    })
})
