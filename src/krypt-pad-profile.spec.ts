import { describe, it, expect } from 'vitest'
import { Profile, Category, Item, Field } from '@/krypt-pad-profile'

describe('Profile', () => {
    describe('from', () => {
        it('throws for empty JSON string', async () => {
            await expect(Profile.from('')).rejects.toThrow('Invalid JSON')
        })

        it('throws for invalid JSON', async () => {
            await expect(Profile.from('{invalid json')).rejects.toThrow()
        })

        it('creates an empty profile for JSON without categories or items', async () => {
            const profile = await Profile.from('{}')
            expect(profile.categories).toEqual([])
            expect(profile.items).toEqual([])
        })

        it('parses categories and items from valid JSON', async () => {
            const json = JSON.stringify({
                categories: [{ id: 'cat-1', name: 'Banking' }],
                items: [
                    {
                        id: 'item-1',
                        name: 'Checkings',
                        notes: 'My checking account',
                        starred: true,
                        categoryId: 'cat-1',
                        fields: [
                            { name: 'username', value: 'jdoe' },
                            { name: 'password', value: 'secret' }
                        ]
                    }
                ]
            })

            const profile = await Profile.from(json)

            expect(profile.categories).toHaveLength(1)
            expect(profile.categories[0].id).toBe('cat-1')
            expect(profile.categories[0].name).toBe('Banking')

            expect(profile.items).toHaveLength(1)
            expect(profile.items[0].id).toBe('item-1')
            expect(profile.items[0].name).toBe('Checkings')
            expect(profile.items[0].notes).toBe('My checking account')
            expect(profile.items[0].starred).toBe(true)
            expect(profile.items[0].categoryId).toBe('cat-1')
            expect(profile.items[0].fields).toHaveLength(2)
            expect(profile.items[0].fields[0].name).toBe('username')
            expect(profile.items[0].fields[0].value).toBe('jdoe')
            expect(profile.items[0].fields[1].name).toBe('password')
            expect(profile.items[0].fields[1].value).toBe('secret')
        })
    })

    describe('toJSON', () => {
        it('serializes the profile back to JSON', async () => {
            const profile = new Profile()
            const category = new Category('cat-1')
            category.name = 'General'
            profile.categories.push(category)

            const item = new Item('item-1')
            item.name = 'WiFi'
            item.notes = 'Home network'
            item.starred = true
            item.categoryId = 'cat-1'
            item.fields.push(new Field('password', 'hunter2'))
            profile.items.push(item)

            const json = JSON.parse(await profile.toJSON())

            expect(json).toEqual({
                categories: [{ id: 'cat-1', name: 'General' }],
                items: [
                    {
                        id: 'item-1',
                        name: 'WiFi',
                        notes: 'Home network',
                        starred: true,
                        categoryId: 'cat-1',
                        fields: [{ name: 'password', value: 'hunter2' }]
                    }
                ]
            })
        })
    })

    describe('getCategories', () => {
        it('returns decrypted category summaries', async () => {
            const profile = new Profile()
            const category = new Category('cat-1')
            category.name = 'Work'
            profile.categories.push(category)

            const categories = await profile.getCategories()

            expect(categories).toEqual([{ id: 'cat-1', name: 'Work' }])
        })
    })
})

describe('Category', () => {
    it('generates an id when none is provided', () => {
        const category = new Category(undefined)
        expect(category.id).toBe('00000000-0000-4000-8000-000000000000')
    })

    it('uses the provided id', () => {
        const category = new Category('custom-id')
        expect(category.id).toBe('custom-id')
    })
})

describe('Item', () => {
    it('generates an id when none is provided and uses defaults', () => {
        const item = new Item(undefined)
        expect(item.id).toBe('00000000-0000-4000-8000-000000000000')
        expect(item.name).toBeUndefined()
        expect(item.notes).toBeUndefined()
        expect(item.starred).toBe(false)
        expect(item.categoryId).toBeUndefined()
        expect(item.fields).toEqual([])
    })

    it('uses the provided id', () => {
        const item = new Item('item-2')
        expect(item.id).toBe('item-2')
    })
})

describe('Field', () => {
    it('uses defaults when no values are provided', () => {
        const field = new Field()
        expect(field.name).toBe('')
        expect(field.value).toBeNull()
    })

    it('sets the provided name and value', () => {
        const field = new Field('email', 'user@example.com')
        expect(field.name).toBe('email')
        expect(field.value).toBe('user@example.com')
    })
})
