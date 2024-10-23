import { IPCBridge } from '@/bridge'

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
    static async from(json: string, passphrase: string): Promise<Profile> {
        // If the json is empty, throw an error
        if (!json) {
            throw new Error('Invalid JSON')
        }

        // If the passphrase is empty, throw an error
        if (!passphrase) {
            throw new Error('Invalid passphrase')
        }

        // Parse the json string
        const profileObject = JSON.parse(json)
        const profile = new Profile()

        // Create the categories
        if (profileObject.categories) {
            for (const c of profileObject.categories) {
                const category = await Category.load(c.id, c.title, passphrase)
                // Add category to profile
                profile.categories.push(category)
            }
        }

        // Create the items
        if (profileObject.items) {
            for (const i of profileObject.items) {
                const item = new Item(i.id, i.categoryId, i.title)
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

    async toJSON(): Promise<string> {
        // Convert the profile into a data structure then stringify it
        const data = {
            categories: this.categories.map((c) => {
                return { id: c.id, title: c.encryptedTitle }
            })
        }

        return JSON.stringify(data)
    }
}

/**
 * Interface for category
 */
interface IIdTitle {
    id: string
    title: string | undefined
}

/**
 * Category for organizing items.
 */
class Category implements IIdTitle {
    id: string
    title: string | undefined
    encryptedTitle: string | undefined

    /**
     * Creates a new category. If no id is passed, a new one is generated.
     * @param {string} id The id of the category
     * @param {string} encryptedTitle The encrypted title of the category
     * @param {string} title The title of the category
     */
    constructor(id: string | undefined, encryptedTitle: string | undefined, title: string | undefined) {
        this.encryptedTitle = encryptedTitle
        this.title = title
        if (!id) {
            this.id = crypto.randomUUID()
        } else {
            this.id = id
        }
    }

    static async load(id: string | undefined, encryptedTitle: string, passphrase: string | undefined): Promise<Category> {
        if (!passphrase) {
            throw new Error('Invalid passphrase')
        }

        // Create a new IPCBridge
        const ipcBridge: IPCBridge = new IPCBridge()

        // Decrypt the title
        const title = await ipcBridge.decryptData(encryptedTitle, passphrase)

        return new Category(id, encryptedTitle, title)
    }

    static async create(title: string, passphrase: string | undefined): Promise<Category> {
        if (!passphrase) {
            throw new Error('Invalid passphrase')
        }

        // Create a new IPCBridge
        const ipcBridge: IPCBridge = new IPCBridge()

        // Encrypt the title
        const encryptedTitle = await ipcBridge.encryptData(title, passphrase)
        console.log('creating category')
        return new Category(undefined, encryptedTitle, title)
    }
}

/**
 * Wrapper for user defined data to encrypt. Contains fields and notes
 */
class Item implements IIdTitle {
    id: string
    title: string | undefined
    notes: string | null
    starred: boolean

    categoryId: string | null

    fields: Array<Field> = []

    /**
     * Creates a new item. If no id is passed, a new one is generated.
     * @param {string} id
     * @param {string} categoryId
     * @param {Buffer} title
     */
    constructor(id: string | null, categoryId: string | null, title: string) {
        if (!id) {
            this.id = crypto.randomUUID()
        } else {
            this.id = id
        }
        this.title = title
        this.notes = null
        this.starred = false
        // Link to a category
        this.categoryId = categoryId
    }
}

/**
 * User defined fields for items
 */
class Field {
    name: string
    value: string | null

    /**
     * Creates a new item.
     * @param {String} name
     * @param {String} value
     */
    constructor(name: string, value: string | null) {
        this.name = name
        this.value = value
    }
}

export { Profile, Category, Item, Field }
export type { IIdTitle }
