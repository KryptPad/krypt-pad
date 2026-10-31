import { describe, it, expect } from 'vitest'
import { mountWithVuetify } from '@/test-utils'
import ConflictDialog from '@/components/ConflictDialog.vue'

describe('ConflictDialog', () => {
    it.each(['reload', 'keep-mine', 'save-as'])('resolves with %s when the user picks it', async (choice) => {
        const wrapper = mountWithVuetify(ConflictDialog)
        const promise = (wrapper.vm as any).resolve('The vault changed.')

        ;(wrapper.vm as any).choose(choice)

        await expect(promise).resolves.toBe(choice)
        wrapper.unmount()
    })

    it('resolves null when dismissed', async () => {
        const wrapper = mountWithVuetify(ConflictDialog)
        const promise = (wrapper.vm as any).resolve('The vault changed.')

        ;(wrapper.vm as any).dismiss()

        await expect(promise).resolves.toBeNull()
        wrapper.unmount()
    })

    it('settles an earlier question when asked again', async () => {
        const wrapper = mountWithVuetify(ConflictDialog)
        const first = (wrapper.vm as any).resolve('first')
        const second = (wrapper.vm as any).resolve('second')

        ;(wrapper.vm as any).choose('reload')

        await expect(first).resolves.toBeNull()
        await expect(second).resolves.toBe('reload')
        wrapper.unmount()
    })
})
