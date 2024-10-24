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
                return { id: c.id, title: c.encryptedName }
            })
        }

        return JSON.stringify(data)
    }
}

/**
 * Interface for objects with id and title
 */
interface IProfileEntity {
    id: string | undefined
    _name: string | undefined
    get name(): string | undefined
    setName(name: string, passphrase: string | undefined): Promise<void>
}

class ProfileEntity implements IProfileEntity {
    id: string
    _name: string | undefined
    encryptedName: string | undefined

    get name(): string | undefined {
        return this._name
    }

    /**
     * Creates a new entity. If no id is passed, a new one is generated.
     * @param {string} id The id of the entity
     * @param {string} encryptedName The encrypted name of the entity
     * @param {string} name The name of the category
     */
    constructor(id: string | undefined) {
        if (!id) {
            this.id = crypto.randomUUID()
        } else {
            this.id = id
        }
    }

    /**
     * Sets the name of the category
     * @param name The name of the category
     * @param passphrase The passphrase to encrypt the name with
     */
    async setName(name: string, passphrase: string | undefined) {
        // Create a new IPCBridge
        const ipcBridge: IPCBridge = new IPCBridge()
        // Encrypt the name
        this.encryptedName = await ipcBridge.encryptData(name, passphrase)
        this._name = name
    }
}

/**
 * Category for organizing items.
 */
class Category extends ProfileEntity {
    // Constructor that calls the super constructor
    constructor(id: string | undefined, encryptedName: string | undefined, name: string | undefined) {
        super(id)
        this.encryptedName = encryptedName
        this._name = name
    }

    /**
     * Loads a category from a json object
     * @param id The id of the category
     * @param encryptedTitle The encrypted title of the category
     * @param passphrase The passphrase to decrypt the title with
     * @returns A new category
     */
    static async load(id: string, encryptedName: string, passphrase: string): Promise<Category> {
        // Create a new IPCBridge
        const ipcBridge: IPCBridge = new IPCBridge()
        const name = await ipcBridge.decryptData(encryptedName, passphrase)

        return new Category(id, encryptedName, name)
    }

    /**
     *
     * @param title
     * @param passphrase
     * @returns
     */
    static async create(title: string, passphrase: string): Promise<Category> {
        // Create a new IPCBridge
        const ipcBridge: IPCBridge = new IPCBridge()
        const encryptedTitle = await ipcBridge.encryptData(title, passphrase)
        const newCategory = new Category(undefined, encryptedTitle, title)
        newCategory.setName(title, passphrase)
        return newCategory
    }
}

/**
 * Wrapper for user defined data to encrypt. Contains fields and notes
 */
class Item implements IProfileEntity {
    id: string
    encryptedTitle: string | undefined
    notes: string | null
    starred: boolean
    categoryId: string | null
    fields: Array<Field> = []

    _title: string | undefined
    get title(): string | undefined {
        return this._title
    }

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
        this._title = title
        this.notes = null
        this.starred = false
        // Link to a category
        this.categoryId = categoryId
    }

    /**
     * Sets the title of the category
     * @param title The title of the category
     * @param passphrase The passphrase to encrypt the title with
     */
    async setTitle(title: string, passphrase: string | undefined) {
        // Create a new IPCBridge
        const ipcBridge: IPCBridge = new IPCBridge()
        // Encrypt the title
        this.encryptedTitle = await ipcBridge.encryptData(title, passphrase)
        this._title = title
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
export type { IProfileEntity as IIdTitle }
