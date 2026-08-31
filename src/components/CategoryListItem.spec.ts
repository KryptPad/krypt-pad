import { describe, it, expect } from 'vitest'
import { mountWithVuetify } from '@/test-utils'
import CategoryListItem from '@/components/CategoryListItem.vue'

describe('CategoryListItem', () => {
    it('emits click when the list item is clicked', async () => {
        const wrapper = mountWithVuetify(CategoryListItem, {
            props: { name: 'General', active: false }
        })

        await wrapper.find('.v-list-item').trigger('click')

        expect(wrapper.emitted('click')).toBeTruthy()
        wrapper.unmount()
    })

    it('renames a category and emits updated', () => {
        const wrapper = mountWithVuetify(CategoryListItem, {
            props: { name: 'General', active: false }
        })

        ;(wrapper.vm as any).enterEditMode()
        ;(wrapper.vm as any).title = 'Renamed'
        ;(wrapper.vm as any).renameCategory()

        expect(wrapper.emitted('updated')).toBeTruthy()
        expect(wrapper.emitted('updated')![0]).toEqual(['Renamed'])
        wrapper.unmount()
    })

    it('closes edit mode', () => {
        const wrapper = mountWithVuetify(CategoryListItem, {
            props: { name: 'General', active: false }
        })

        ;(wrapper.vm as any).enterEditMode()
        ;(wrapper.vm as any).close()

        expect((wrapper.vm as any).isEditing).toBe(false)
        wrapper.unmount()
    })
})
