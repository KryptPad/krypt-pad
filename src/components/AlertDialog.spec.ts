import { describe, it, expect } from 'vitest'
import { mountWithVuetify } from '@/test-utils'
import AlertDialog from '@/components/AlertDialog.vue'

describe('AlertDialog', () => {
    it('resolves true when the user clicks OK', async () => {
        const wrapper = mountWithVuetify(AlertDialog)
        const promise = (wrapper.vm as any).alert('Something happened')

        ;(wrapper.vm as any).okHandler()

        await expect(promise).resolves.toBe(true)
        wrapper.unmount()
    })

    it('applies error styling when error() is invoked', async () => {
        const wrapper = mountWithVuetify(AlertDialog)
        const errorPromise = (wrapper.vm as any).error('An error occurred')

        expect((wrapper.vm as any).title).toBe('Error')
        expect((wrapper.vm as any).color).toBe('red')
        expect((wrapper.vm as any).icon).toBe('mdi-alert')

        ;(wrapper.vm as any).okHandler()
        await expect(errorPromise).resolves.toBe(true)
        wrapper.unmount()
    })
})
