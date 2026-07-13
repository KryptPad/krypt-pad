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
                item._encryptedNotes = i.notes
                item.starred = i.starred

                // Add fields to the item (stored encrypted)
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
                return { id: c.id, name: c._encryptedName }
            }),
            items: this.items.map((i) => {
                return {
                    id: i.id,
                    name: i._encryptedName,
                    notes: i._encryptedNotes,
                    starred: i.starred,
                    categoryId: i.categoryId,
                    fields: i.fields.map((f) => {
                        return { name: f.encryptedName, value: f.encryptedValue }
                    })
                }
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
    _encryptedNotes: string | undefined
    starred: boolean = false
    categoryId: string | undefined
    fields: Array<Field> = []

    // Constructor that calls the super constructor
    constructor(id: string | undefined) {
        super(id)
    }

    /**
     * Decrypt the items to an IDecryptedItem object.
     * Creates NEW Field objects for the UI layer so they are decoupled from the storage fields.
     */
    async decrypt(passphrase: string | undefined): Promise<IDecryptedItem> {
        console.info('Decrypting item', this)
        // Create a new IPCBridge
        const ipcBridge: IPCBridge = new IPCBridge()
        // Decrypt the name
        const name = await ipcBridge.decryptData(this._encryptedName, passphrase)
        // Decrypt the notes
        const notes = await ipcBridge.decryptData(this._encryptedNotes, passphrase)

        // Create NEW Field objects for the UI, decoupled from storage fields.
        // Decrypt each storage field's encrypted data into the new field's plaintext properties.
        const decryptedFields: Field[] = []
        for (const storageField of this.fields) {
            const uiField = new Field()
            uiField.name = (await ipcBridge.decryptData(storageField.encryptedName, passphrase)) ?? ''
            uiField.value = (await ipcBridge.decryptData(storageField.encryptedValue ?? undefined, passphrase)) ?? null
            decryptedFields.push(uiField)
        }

        return {
            id: this.id,
            name: name,
            notes: notes,
            starred: this.starred,
            categoryId: this.categoryId,
            fields: decryptedFields
        }
    }

    /**
     * Encrypt the items from an IDecryptedItem object.
     * Rebuilds the storage fields from the UI field data to avoid reactive loop.
     */
    async encrypt(data: IDecryptedItem, passphrase: string | undefined) {
        console.info('Encrypting item', data)
        // Create a new IPCBridge
        const ipcBridge: IPCBridge = new IPCBridge()
        // Encrypt the name
        this._encryptedName = await ipcBridge.encryptData(data.name, passphrase)
        // Encrypt the notes
        this._encryptedNotes = await ipcBridge.encryptData(data.notes, passphrase)
        this.starred = data.starred
        this.categoryId = data.categoryId

        // Rebuild storage fields from UI fields, encrypting each
        const encryptedFields: Field[] = []
        for (const uiField of data.fields) {
            const storageField = new Field()
            storageField.name = uiField.name
            storageField.value = uiField.value
            await storageField.encrypt(passphrase)
            encryptedFields.push(storageField)
        }
        this.fields = encryptedFields
    }
}

/**
 * User defined fields for items.
 * Stores encrypted properties (encryptedName, encryptedValue) for persistence
 * and plaintext properties (name, value) for UI binding.
 */
class Field {
    encryptedName: string | undefined
    encryptedValue: string | null
    name: string
    value: string | null

    /**
     * Creates a new field with PRE-ENCRYPTED name/value (as read from file).
     * @param encryptedName The encrypted field name
     * @param encryptedValue The encrypted field value
     */
    constructor(encryptedName?: string, encryptedValue?: string | null) {
        this.encryptedName = encryptedName
        this.encryptedValue = encryptedValue ?? null
        this.name = ''
        this.value = null
    }

    /**
     * Decrypts the field's name and value into the plaintext properties
     */
    async decrypt(passphrase: string | undefined): Promise<void> {
        const ipcBridge: IPCBridge = new IPCBridge()
        this.name = (await ipcBridge.decryptData(this.encryptedName, passphrase)) ?? ''
        this.value = (await ipcBridge.decryptData(this.encryptedValue ?? undefined, passphrase)) ?? null
    }

    /**
     * Encrypts the plaintext name/value into the encrypted properties
     */
    async encrypt(passphrase: string | undefined): Promise<void> {
        const ipcBridge: IPCBridge = new IPCBridge()
        this.encryptedName = await ipcBridge.encryptData(this.name, passphrase)
        this.encryptedValue = (await ipcBridge.encryptData(this.value ?? undefined, passphrase)) ?? null
    }
}

export { Profile, Category, Item, Field }
export type { IProfileEntity as IIdTitle, IDecryptedCategory, IDecryptedItem }
