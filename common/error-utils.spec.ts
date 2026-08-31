import { describe, it, expect } from 'vitest'
import { KryptPadError, KryptPadErrorCodes, getExceptionMessage } from './error-utils'

describe('KryptPadError', () => {
    it('creates an error with default values', () => {
        const error = new KryptPadError()
        expect(error.name).toBe('KryptPadError')
        expect(error.message).toBe('An unknown error occurred')
        expect(error.code).toBe(KryptPadErrorCodes.GENERIC)
    })

    it('creates an error with a custom message and code', () => {
        const error = new KryptPadError('Decryption failed', KryptPadErrorCodes.DECRYPT_ERROR)
        expect(error.message).toBe('Decryption failed')
        expect(error.code).toBe(KryptPadErrorCodes.DECRYPT_ERROR)
    })
})

describe('KryptPadError.fromError', () => {
    it('returns the same instance when given a KryptPadError', () => {
        const error = new KryptPadError('test')
        expect(KryptPadError.fromError(error)).toBe(error)
    })

    it('creates a new KryptPadError from a serialized KryptPadError', () => {
        const serialized = { name: 'KryptPadError', message: 'Serialized error', code: KryptPadErrorCodes.DECRYPT_ERROR }
        const result = KryptPadError.fromError(serialized)
        expect(result).toBeInstanceOf(KryptPadError)
        expect(result.name).toBe('KryptPadError')
        expect(result.message).toBe('Serialized error')
        expect(result.code).toBe(KryptPadErrorCodes.DECRYPT_ERROR)
    })

    it('converts a plain Error into a KryptPadError', () => {
        const result = KryptPadError.fromError(new Error('plain error'))
        expect(result).toBeInstanceOf(KryptPadError)
        expect(result.message).toBe('plain error')
        expect(result.code).toBe(KryptPadErrorCodes.GENERIC)
    })

    it('creates a default KryptPadError for unknown input', () => {
        const result = KryptPadError.fromError('just a string')
        expect(result).toBeInstanceOf(KryptPadError)
        expect(result.message).toBe('An unknown error occurred.')
        expect(result.code).toBe(KryptPadErrorCodes.GENERIC)
    })
})

describe('getExceptionMessage', () => {
    it('returns the string as-is', () => {
        expect(getExceptionMessage('a string error')).toBe('a string error')
    })

    it('returns an Error message', () => {
        expect(getExceptionMessage(new Error('error message'))).toBe('error message')
    })

    it('returns a KryptPadError message', () => {
        expect(getExceptionMessage(new KryptPadError('krypt error'))).toBe('krypt error')
    })

    it('returns the default message for unknown input', () => {
        expect(getExceptionMessage(42)).toBe('An unknown error occurred.')
    })
})
