import { describe, it, expect } from 'vitest'
import { nextTick } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mountWithVuetify } from '@/test-utils'
import PassphrasePrompt from '@/components/PassphrasePrompt.vue'

describe('PassphrasePrompt', () => {
    it('opens the dialog when show is invoked', () => {
        const wrapper = mountWithVuetify(PassphrasePrompt, { props: { passphraseIsNew: false } })

        ;(wrapper.vm as any).show()

        expect((wrapper.vm as any).dialogOpen).toBe(true)
        wrapper.unmount()
    })

    it('emits closed with the passphrase when ok is invoked', async () => {
        const wrapper = mountWithVuetify(PassphrasePrompt, { props: { passphraseIsNew: false } })

        ;(wrapper.vm as any).show()
        await nextTick()
        ;(wrapper.vm as any).passphrase = 'secret'
        ;(wrapper.vm as any).ok()
        await nextTick()
        await flushPromises()

        expect(wrapper.emitted('closed')).toBeTruthy()
        expect(wrapper.emitted('closed')![0]).toEqual(['secret'])
        wrapper.unmount()
    })

    it('clears the passphrase and emits closed on cancel', async () => {
        const wrapper = mountWithVuetify(PassphrasePrompt, { props: { passphraseIsNew: false } })

        ;(wrapper.vm as any).show()
        await nextTick()
        ;(wrapper.vm as any).passphrase = 'secret'
        ;(wrapper.vm as any).cancel()
        await nextTick()
        await flushPromises()

        expect(wrapper.emitted('closed')).toBeTruthy()
        expect(wrapper.emitted('closed')![0]).toEqual([undefined])
        expect((wrapper.vm as any).passphrase).toBeUndefined()
        wrapper.unmount()
    })

    describe('when creating a new file', () => {
        it('stays open when the passphrases do not match', async () => {
            const wrapper = mountWithVuetify(PassphrasePrompt, { props: { passphraseIsNew: true } })

            ;(wrapper.vm as any).show()
            await nextTick()
            ;(wrapper.vm as any).passphrase = 'correct horse battery'
            ;(wrapper.vm as any).confirmPassphrase = 'correct horse bttery'
            ;(wrapper.vm as any).ok()
            await nextTick()
            await flushPromises()

            expect((wrapper.vm as any).dialogOpen).toBe(true)
            expect((wrapper.vm as any).validationError).toBe('The passphrases do not match.')
            expect(wrapper.emitted('closed')).toBeFalsy()
            wrapper.unmount()
        })

        it('stays open when the passphrase is too short', async () => {
            const wrapper = mountWithVuetify(PassphrasePrompt, { props: { passphraseIsNew: true } })

            ;(wrapper.vm as any).show()
            await nextTick()
            ;(wrapper.vm as any).passphrase = 'short'
            ;(wrapper.vm as any).confirmPassphrase = 'short'
            ;(wrapper.vm as any).ok()
            await nextTick()
            await flushPromises()

            expect((wrapper.vm as any).dialogOpen).toBe(true)
            expect((wrapper.vm as any).validationError).toContain('at least')
            expect(wrapper.emitted('closed')).toBeFalsy()
            wrapper.unmount()
        })

        it('emits closed when the passphrases match and are long enough', async () => {
            const wrapper = mountWithVuetify(PassphrasePrompt, { props: { passphraseIsNew: true } })

            ;(wrapper.vm as any).show()
            await nextTick()
            ;(wrapper.vm as any).passphrase = 'correct horse battery'
            ;(wrapper.vm as any).confirmPassphrase = 'correct horse battery'
            ;(wrapper.vm as any).ok()
            await nextTick()
            await flushPromises()

            expect(wrapper.emitted('closed')![0]).toEqual(['correct horse battery'])
            wrapper.unmount()
        })

        it('clears both passphrase inputs on cancel', async () => {
            const wrapper = mountWithVuetify(PassphrasePrompt, { props: { passphraseIsNew: true } })

            ;(wrapper.vm as any).show()
            await nextTick()
            ;(wrapper.vm as any).passphrase = 'correct horse battery'
            ;(wrapper.vm as any).confirmPassphrase = 'correct horse battery'
            ;(wrapper.vm as any).cancel()
            await nextTick()
            await flushPromises()

            expect((wrapper.vm as any).passphrase).toBeUndefined()
            expect((wrapper.vm as any).confirmPassphrase).toBeUndefined()
            wrapper.unmount()
        })
    })
})
