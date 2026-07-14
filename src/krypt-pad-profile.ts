/**
 * A profile is the top most entity. It contains all the categories the user defines.
 */
class Profile {
    categories: Array<Category> = []
    items: Array<Item> = []

    /**
     * Creates a new profile with a passphrase
     * @param passphrase The passphrase to encrypt or decrypt the profile with
     */
    constructor() {}

    /**
     * Creates a profile from a json string
     * @param {string} json
     * @returns
     */
    static async from(json: string): Promise<Profile> {
        // If the json is empty, throw an error
        if (!json) {
            throw new Error('Invalid JSON')
        }

        // Parse the json string
        const profileObject = JSON.parse(json)
        const profile = new Profile()

        // Create the categories
        if (profileObject.categories) {
            for (const c of profileObject.categories) {
                const category = new Category(c.id)
                category.name = c.name
                // Add category to profile
                profile.categories.push(category)
            }
        }

        // Create the items
        if (profileObject.items) {
            for (const i of profileObject.items) {
                const item = new Item(i.id)
                item.categoryId = i.categoryId
                item.name = i.name
                item.notes = i.notes
                item.starred = i.starred

                // Add fields to the item
                for (const field of i.fields) {
                    item.fields.push(new Field(field.name, field.value))
                }

                // Add category to profile
                profile.items.push(item)
            }
        }

        return profile
    }

    /**
     * Converts the profile to a JSON string
     * @returns A JSON string representing the profile
     */
    async toJSON(): Promise<string> {
        // Convert the profile into a data structure then stringify it
        const data = {
            categories: this.categories.map((c) => {
                return { id: c.id, name: c.name }
            }),
            items: this.items.map((i) => {
                return {
                    id: i.id,
                    name: i.name,
                    notes: i.notes,
                    starred: i.starred,
                    categoryId: i.categoryId,
                    fields: i.fields.map((f) => {
                        return { name: f.name, value: f.value }
                    })
                }
            })
        }

        return JSON.stringify(data)
    }

    async getCategories(): Promise<Array<IDecryptedCategory>> {
        return this.categories.map((category) => {
            return {
                id: category.id,
                name: category.name
            }
        })
    }
}

/**
 * Interface for objects with id and name
 */
interface IProfileEntity {
    id: string | undefined
    name: string | undefined
}

class ProfileEntity implements IProfileEntity {
    id: string
    name: string | undefined

    /**
     * Creates a new entity. If no id is passed, a new one is generated.
     * @param {string} id The id of the entity
     */
    constructor(id: string | undefined) {
        if (!id) {
            this.id = crypto.randomUUID()
        } else {
            this.id = id
        }
    }
}

interface IDecryptedCategory {
    id: string | undefined
    name: string | undefined
}

/**
 * Category for organizing items.
 */
class Category extends ProfileEntity {
    // Constructor that calls the super constructor
    constructor(id: string | undefined) {
        super(id)
    }
}

/**
 * Decrypted representation of an item (plaintext used in UI).
 * Fields in this object have their name/value in plaintext.
 */
interface IDecryptedItem {
    id: string | undefined
    name: string | undefined
    notes: string | undefined
    starred: boolean
    categoryId: string | undefined
    fields: Array<Field>
}

/**
 * Wrapper for user defined data to encrypt. Contains fields and notes
 */
class Item extends ProfileEntity {
    notes: string | undefined
    starred: boolean = false
    categoryId: string | undefined
    fields: Array<Field> = []

    // Constructor that calls the super constructor
    constructor(id: string | undefined) {
        super(id)
    }
}

/**
 * User defined fields for items.
 */
class Field {
    name: string
    value: string | null

    /**
     * Creates a new field.
     * @param name The field name
     * @param value The field value
     */
    constructor(name?: string, value?: string | null) {
        this.name = name ?? ''
        this.value = value ?? null
    }
}

export { Profile, Category, Item, Field }
export type { IProfileEntity as IIdTitle, IDecryptedCategory, IDecryptedItem }
