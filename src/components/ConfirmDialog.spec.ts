import { describe, it, expect } from 'vitest'
import { mountWithVuetify } from '@/test-utils'
import ConfirmDialog from '@/components/ConfirmDialog.vue'

describe('ConfirmDialog', () => {
    it('resolves true when the user confirms', async () => {
        const wrapper = mountWithVuetify(ConfirmDialog)
        const promise = (wrapper.vm as any).confirm('Are you sure?')

        ;(wrapper.vm as any).yesHandler()

        await expect(promise).resolves.toBe(true)
        wrapper.unmount()
    })

    it('resolves false when the user cancels', async () => {
        const wrapper = mountWithVuetify(ConfirmDialog)
        const promise = (wrapper.vm as any).confirm('Are you sure?')

        ;(wrapper.vm as any).noHandler()

        await expect(promise).resolves.toBe(false)
        wrapper.unmount()
    })
})
