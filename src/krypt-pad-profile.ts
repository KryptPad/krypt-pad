/**
 * A profile is the top most entity. It contains all the categories the user defines.
 */
class Profile {
    categories: Array<Category> = []
    items: Array<Item> = []
    /** Items deleted from the profile, kept so a later merge can tell a deletion from an addition */
    deletedItems: Array<IDeletion> = []
    /** Categories deleted from the profile, kept for the same reason as deletedItems */
    deletedCategories: Array<IDeletion> = []
    /** Properties written by a newer app version, preserved so they survive a save */
    unknownProperties: Record<string, unknown> = {}

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
        profile.unknownProperties = pickUnknown(profileObject, PROFILE_KEYS)

        // Create the categories
        if (profileObject.categories) {
            for (const c of profileObject.categories) {
                const category = new Category(c.id)
                category.name = c.name
                category.modified = c.modified
                category.unknownProperties = pickUnknown(c, CATEGORY_KEYS)
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
                item.modified = i.modified
                item.unknownProperties = pickUnknown(i, ITEM_KEYS)

                // Add fields to the item
                for (const field of i.fields ?? []) {
                    item.fields.push(new Field(field.name, field.value))
                }

                // Add attachments to the item
                for (const a of i.attachments ?? []) {
                    item.attachments.push(new Attachment(a.id, a.name, a.size, a.key, a.added))
                }

                // Add category to profile
                profile.items.push(item)
            }
        }

        profile.deletedItems = parseDeletions(profileObject.deletedItems)
        profile.deletedCategories = parseDeletions(profileObject.deletedCategories)

        return profile
    }

    /**
     * Converts the profile to a JSON string
     * @returns A JSON string representing the profile
     */
    async toJSON(): Promise<string> {
        // Convert the profile into a data structure then stringify it
        const data: Record<string, unknown> = {
            ...this.unknownProperties,
            categories: this.categories.map((c) => categoryToData(c)),
            items: this.items.map((i) => itemToData(i))
        }

        // Only written once there is something to record, so profiles that
        // don't use these stay exactly as before
        if (this.deletedItems.length) {
            data.deletedItems = this.deletedItems.map(({ id, deleted }) => ({ id, deleted }))
        }
        if (this.deletedCategories.length) {
            data.deletedCategories = this.deletedCategories.map(({ id, deleted }) => ({ id, deleted }))
        }

        return JSON.stringify(data)
    }

    /**
     * Whether any item references an attachment
     */
    hasAttachments(): boolean {
        return this.items.some((i) => i.attachments.length > 0)
    }

    /**
     * Ids of every attachment the profile references
     */
    getAttachmentIds(): Array<string> {
        return this.items.flatMap((i) => i.attachments.map((a) => a.id))
    }

    /**
     * Removes an item, recording the deletion
     * @param item The item to remove
     * @returns Whether the item was found
     */
    deleteItem(item: Item): boolean {
        const index = this.items.findIndex((i) => i.id === item.id)
        if (index < 0) {
            return false
        }

        this.items.splice(index, 1)
        this.deletedItems.push({ id: item.id, deleted: new Date().toISOString() })
        return true
    }

    /**
     * Removes a category, recording the deletion. Items in it are left without a category.
     * @param category The category to remove
     * @returns Whether the category was found
     */
    deleteCategory(category: Category): boolean {
        const index = this.categories.findIndex((c) => c.id === category.id)
        if (index < 0) {
            return false
        }

        this.categories.splice(index, 1)
        this.deletedCategories.push({ id: category.id, deleted: new Date().toISOString() })
        for (const item of this.items.filter((i) => i.categoryId === category.id)) {
            item.categoryId = undefined
        }
        return true
    }

    /**
     * Captures the content of each item and category, ignoring modified times,
     * so later changes can be detected with stampModified.
     * @returns A map of entity id to its serialized content
     */
    snapshot(): Map<string, string> {
        const snapshot = new Map<string, string>()
        for (const c of this.categories) {
            snapshot.set(c.id, JSON.stringify({ ...categoryToData(c), modified: undefined }))
        }
        for (const i of this.items) {
            snapshot.set(i.id, JSON.stringify({ ...itemToData(i), modified: undefined }))
        }

        return snapshot
    }

    /**
     * Sets the modified time of every item and category that is new or has
     * changed since the snapshot was taken.
     * @param previous A snapshot from an earlier call to snapshot
     * @param now The modified time to set
     * @returns A snapshot of the current content
     */
    stampModified(previous: Map<string, string>, now: string = new Date().toISOString()): Map<string, string> {
        const current = this.snapshot()
        for (const entity of [...this.categories, ...this.items]) {
            if (previous.get(entity.id) !== current.get(entity.id)) {
                entity.modified = now
            }
        }

        return current
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

/**
 * Records when an entity was deleted
 */
interface IDeletion {
    id: string
    deleted: string
}

// Properties this version reads. Anything else in the JSON was written by a
// newer version and is carried through untouched.
const PROFILE_KEYS = ['categories', 'items', 'deletedItems', 'deletedCategories']
const CATEGORY_KEYS = ['id', 'name', 'modified']
const ITEM_KEYS = ['id', 'name', 'notes', 'starred', 'categoryId', 'modified', 'fields', 'attachments']

/**
 * Collects the properties of a parsed object that this version doesn't know.
 */
function pickUnknown(source: unknown, knownKeys: Array<string>): Record<string, unknown> {
    const unknownProperties: Record<string, unknown> = {}
    if (source && typeof source === 'object') {
        for (const [key, value] of Object.entries(source)) {
            if (!knownKeys.includes(key)) {
                unknownProperties[key] = value
            }
        }
    }

    return unknownProperties
}

/**
 * Reads a list of deletion records, skipping malformed entries.
 */
function parseDeletions(source: unknown): Array<IDeletion> {
    if (!Array.isArray(source)) {
        return []
    }

    return source.filter((d) => typeof d?.id === 'string' && typeof d?.deleted === 'string').map((d) => ({ id: d.id, deleted: d.deleted }))
}

function categoryToData(c: Category) {
    return { ...c.unknownProperties, id: c.id, name: c.name, modified: c.modified }
}

function itemToData(i: Item) {
    const data: Record<string, unknown> = {
        ...i.unknownProperties,
        id: i.id,
        name: i.name,
        notes: i.notes,
        starred: i.starred,
        categoryId: i.categoryId,
        modified: i.modified,
        fields: i.fields.map((f) => {
            return { name: f.name, value: f.value }
        })
    }

    if (i.attachments.length) {
        data.attachments = i.attachments.map((a) => ({ id: a.id, name: a.name, size: a.size, key: a.key, added: a.added }))
    }

    return data
}

class ProfileEntity implements IProfileEntity {
    id: string
    name: string | undefined
    /** When the entity was last changed, as an ISO string */
    modified: string | undefined
    /** Properties written by a newer app version, preserved so they survive a save */
    unknownProperties: Record<string, unknown> = {}

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
    attachments: Array<Attachment> = []

    // Constructor that calls the super constructor
    constructor(id: string | undefined) {
        super(id)
    }
}

/**
 * A file attached to an item. The file itself is stored encrypted next to the
 * vault; the profile holds its metadata and the key that decrypts it.
 */
class Attachment {
    id: string
    name: string
    size: number
    /** Base64 key that decrypts the attachment's file */
    key: string
    /** When the attachment was added, as an ISO string */
    added: string | undefined

    constructor(id: string, name: string, size: number, key: string, added?: string) {
        this.id = id
        this.name = name
        this.size = size
        this.key = key
        this.added = added
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

export { Profile, Category, Item, Field, Attachment }
export type { IProfileEntity as IIdTitle, IDecryptedCategory, IDecryptedItem, IDeletion }
