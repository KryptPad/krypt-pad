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
                const category = new Category(c.id)
                category._encryptedName = c.name
                // Add category to profile
                profile.categories.push(category)
            }
        }

        // Create the items
        if (profileObject.items) {
            for (const i of profileObject.items) {
                const item = new Item(i.id)
                item.categoryId = i.categoryId
                item._encryptedName = i.name
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
                return { id: c.id, name: c._encryptedName }
            })
        }

        return JSON.stringify(data)
    }

    async getCategories(passphrase: string | undefined): Promise<Array<IDecryptedCategory>> {
        // Create a new array to store the decrypted categories
        const decryptedCategories: Array<IDecryptedCategory> = []
        for (const category of this.categories ?? []) {
            // Decrypt the category and add it to the list
            decryptedCategories.push(await category.decrypt(passphrase))
        }

        return decryptedCategories
    }
}

/**
 * Interface for objects with id and name
 */
interface IProfileEntity {
    id: string | undefined
    _encryptedName: string | undefined
    // get name(): string | undefined
    // setName(name: string, passphrase: string | undefined): Promise<void>
}

class ProfileEntity implements IProfileEntity {
    id: string
    _encryptedName: string | undefined

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

    // /**
    //  * Sets the name of the category
    //  * @param name The name of the category
    //  * @param passphrase The passphrase to encrypt the name with
    //  */
    // async setName(name: string, passphrase: string | undefined) {
    //     // Create a new IPCBridge
    //     const ipcBridge: IPCBridge = new IPCBridge()
    //     // Encrypt the name
    //     this.encryptedName = await ipcBridge.encryptData(name, passphrase)
    //     this._name = name
    // }
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

    /**
     * Decrypt the category to an IDecryptedCategory object
     */
    async decrypt(passphrase: string | undefined): Promise<IDecryptedCategory> {
        // Create a new IPCBridge
        const ipcBridge: IPCBridge = new IPCBridge()
        // Decrypt the name
        const name = await ipcBridge.decryptData(this._encryptedName, passphrase)

        return {
            id: this.id,
            name: name
        }
    }

    /**
     * Encrypt the category from an IDecryptedCategory object
     */
    async encrypt(data: IDecryptedCategory, passphrase: string | undefined) {
        // Create a new IPCBridge
        const ipcBridge: IPCBridge = new IPCBridge()
        // Encrypt the name
        this._encryptedName = await ipcBridge.encryptData(data.name, passphrase)
    }
}

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

    /**
     * Decrypt the items to an IDecryptedItem object
     */
    async decrypt(passphrase: string | undefined): Promise<IDecryptedItem> {
        // Create a new IPCBridge
        const ipcBridge: IPCBridge = new IPCBridge()
        // Decrypt the name
        const name = await ipcBridge.decryptData(this._encryptedName, passphrase)
        // Decrypt the notes
        const notes = await ipcBridge.decryptData(this.notes, passphrase)

        return {
            id: this.id,
            name: name,
            notes: notes,
            starred: this.starred,
            categoryId: this.categoryId,
            fields: this.fields
        }
    }

    /**
     * Encrypt the items from an IDecryptedItem object
     */
    async encrypt(data: IDecryptedItem, passphrase: string | undefined) {
        // Create a new IPCBridge
        const ipcBridge: IPCBridge = new IPCBridge()
        // Encrypt the name
        this._encryptedName = await ipcBridge.encryptData(data.name, passphrase)
        // Encrypt the notes
        this.notes = await ipcBridge.encryptData(data.notes, passphrase)
        this.starred = data.starred
        this.categoryId = data.categoryId
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
export type { IProfileEntity as IIdTitle, IDecryptedCategory, IDecryptedItem }
