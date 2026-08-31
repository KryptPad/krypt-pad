import { describe, it, expect } from 'vitest'
import { mountWithVuetify } from '@/test-utils'
import ValueTextField from '@/components/ValueTextField.vue'

describe('ValueTextField', () => {
    it('emits save with the title and target when save is invoked', () => {
        const target = { id: 'cat-1' }
        const wrapper = mountWithVuetify(ValueTextField, { props: { target } })

        ;(wrapper.vm as any).title = 'My Category'
        ;(wrapper.vm as any).save()

        expect(wrapper.emitted('save')).toBeTruthy()
        expect(wrapper.emitted('save')![0]).toEqual(['My Category', target])
        expect(wrapper.emitted('closed')).toBeTruthy()
        wrapper.unmount()
    })

    it('does not emit save when the title is empty', () => {
        const wrapper = mountWithVuetify(ValueTextField, { props: { target: {} } })

        ;(wrapper.vm as any).title = null
        ;(wrapper.vm as any).save()

        expect(wrapper.emitted('save')).toBeFalsy()
        wrapper.unmount()
    })

    it('emits closed when close is invoked', () => {
        const wrapper = mountWithVuetify(ValueTextField, { props: { target: {} } })

        ;(wrapper.vm as any).close()

        expect(wrapper.emitted('closed')).toBeTruthy()
        wrapper.unmount()
    })
})
