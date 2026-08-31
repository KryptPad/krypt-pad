import { describe, it, expect } from 'vitest'
import { mountWithVuetify } from '@/test-utils'
import NameValue from '@/components/NameValue.vue'
import { Field } from '@/krypt-pad-profile'

describe('NameValue', () => {
    it('updates the field value on value change', () => {
        const field = new Field('username', 'old')
        const wrapper = mountWithVuetify(NameValue, { props: { modelValue: field } })

        ;(wrapper.vm as any).onValueChange({ target: { value: 'new' } })

        expect(field.value).toBe('new')
        expect(wrapper.emitted('update:modelValue')).toBeTruthy()
        wrapper.unmount()
    })

    it('renames a field', () => {
        const field = new Field('username', 'value')
        const wrapper = mountWithVuetify(NameValue, { props: { modelValue: field } })

        ;(wrapper.vm as any).startEdit()
        ;(wrapper.vm as any).draftFieldName = 'password'
        ;(wrapper.vm as any).saveField()

        expect(field.name).toBe('password')
        expect(wrapper.emitted('update:modelValue')).toBeTruthy()
        expect((wrapper.vm as any).isEditing).toBe(false)
        wrapper.unmount()
    })

    it('cancels edit mode without changing the field name', () => {
        const field = new Field('username', 'value')
        const wrapper = mountWithVuetify(NameValue, { props: { modelValue: field } })

        ;(wrapper.vm as any).startEdit()
        ;(wrapper.vm as any).draftFieldName = 'changed'
        ;(wrapper.vm as any).cancelEdit()

        expect(field.name).toBe('username')
        expect((wrapper.vm as any).isEditing).toBe(false)
        wrapper.unmount()
    })

    it('emits delete with the field', () => {
        const field = new Field('username', 'value')
        const wrapper = mountWithVuetify(NameValue, { props: { modelValue: field } })

        ;(wrapper.vm as any).deleteField()

        expect(wrapper.emitted('delete')).toBeTruthy()
        expect(wrapper.emitted('delete')![0]).toEqual([field])
        wrapper.unmount()
    })
})
