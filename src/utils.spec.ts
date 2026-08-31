import { describe, it, expect } from 'vitest'
import { getFileName, getDirectoryFromFilePath, ensureExtension, validateRules, hexToRgba } from '@/utils'

describe('getFileName', () => {
    it('returns the last path segment for a forward-slash path', () => {
        expect(getFileName('/home/user/vault.kpf')).toBe('vault.kpf')
    })

    it('returns the last path segment for a Windows backslash path', () => {
        expect(getFileName('C:\\Users\\Eric\\vault.kpf')).toBe('vault.kpf')
    })

    it('returns the file name when the path has no directory', () => {
        expect(getFileName('vault.kpf')).toBe('vault.kpf')
    })

    it('returns an empty string when given an empty path', () => {
        expect(getFileName('')).toBe('')
    })
})

describe('getDirectoryFromFilePath', () => {
    it('returns the directory part of a forward-slash path', () => {
        expect(getDirectoryFromFilePath('/home/user/vault.kpf')).toBe('/home/user')
    })

    it('returns the directory part of a Windows backslash path', () => {
        expect(getDirectoryFromFilePath('C:\\Users\\Eric\\vault.kpf')).toBe('C:/Users/Eric')
    })

    it('returns undefined when the path has no directory separator', () => {
        expect(getDirectoryFromFilePath('vault.kpf')).toBeUndefined()
    })

    it('returns undefined for an empty path', () => {
        expect(getDirectoryFromFilePath('')).toBeUndefined()
    })
})

describe('ensureExtension', () => {
    it('adds the extension when the path has no extension', () => {
        expect(ensureExtension('/home/user/vault', 'kpf')).toBe('/home/user/vault.kpf')
    })

    it('does not change the path when it already has an extension', () => {
        expect(ensureExtension('/home/user/vault.kpf', 'kpf')).toBe('/home/user/vault.kpf')
    })

    it('does not change the path when it has a different extension', () => {
        expect(ensureExtension('/home/user/vault.txt', 'kpf')).toBe('/home/user/vault.txt')
    })
})

describe('validateRules', () => {
    it('returns true when all rules pass', () => {
        const rules = [(value: string) => !!value || 'Required', (value: string) => value.length >= 3 || 'Too short']
        expect(validateRules(rules, 'hello')).toBe(true)
    })

    it('returns false when any rule fails', () => {
        const rules = [(value: string) => !!value || 'Required', (value: string) => value.length >= 3 || 'Too short']
        expect(validateRules(rules, 'hi')).toBe(false)
    })

    it('returns true when there are no rules', () => {
        expect(validateRules([], 'anything')).toBe(true)
    })
})

describe('hexToRgba', () => {
    it('converts a hex color to rgba with the given alpha', () => {
        expect(hexToRgba('#ff0000', 0.5)).toBe('rgba(255, 0, 0, 0.5)')
    })

    it('converts a black hex color', () => {
        expect(hexToRgba('#000000', 1)).toBe('rgba(0, 0, 0, 1)')
    })

    it('converts a white hex color', () => {
        expect(hexToRgba('#ffffff', 0)).toBe('rgba(255, 255, 255, 0)')
    })
})
