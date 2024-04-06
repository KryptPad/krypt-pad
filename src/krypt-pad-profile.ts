
/**
 * A profile is the top most entity. It contains all the categories the user defines.
 */
class Profile {
    categories: Array<Category> = [];
    items: Array<Item> = [];

    constructor() {
    }

    /**
     * Creates a profile from a json string
     * @param {string} json 
     * @returns 
     */
    static from(json: string): Profile | null {
        if (!json) { return null; }

        // Parse the json string
        const profileObject = JSON.parse(json);

        // Create the Profile
        const profile = new Profile();

        // Create the categories
        for (const c of profileObject.categories) {
            const category = new Category(c.id, c.title);
            // Add category to profile
            profile.categories.push(category);

        }

        // Create the items
        for (const i of profileObject.items) {
            const item = new Item(i.id, i.categoryId, i.title);
            item.notes = i.notes;
            item.starred = i.starred;

            // Add fields to the item
            for (const field of i.fields) {
                item.fields.push(new Field(field.name, field.value));
            }

            // Add category to profile
            profile.items.push(item);

        }

        return profile;

    }

}

/**
 * Interface for category
 */
interface IIdTitle {
    id: string | null
    title: string;
}

/**
 * Category for organizing items.
 */
class Category implements IIdTitle {
    id: string;
    title: string;
    /**
     * Creates a new category. If no id is passed, a new one is generated.
     * @param {String} id 
     * @param {String} title 
     */
    constructor(id: string | null, title: string) {
        this.title = title;
        if (!id) {
            this.id = crypto.randomUUID();
        } else {
            this.id = id;
        }

    }

}

/**
 * Wrapper for user defined data to encrypt. Contains fields and notes
 */
class Item implements IIdTitle {
    id: string;
    title: string;
    notes: string | null;
    starred: boolean;

    categoryId: string | null;

    fields: Array<Field> = [];

    /**
     * Creates a new item. If no id is passed, a new one is generated.
     * @param {String} id 
     * @param {String} categoryId 
     * @param {String} title 
     */
    constructor(id: string | null, categoryId: string | null, title: string | null) {
        if (!id) {
            this.id = crypto.randomUUID();
        } else {
            this.id = id;
        }
        this.title = title ?? 'Untitled';
        this.notes = null;
        this.starred = false;
        // Link to a category
        this.categoryId = categoryId;

    }

}

/**
 * User defined fields for items
 */
class Field {
    name: string;
    value: string | null;

    /**
     * Creates a new item.
     * @param {String} name 
     * @param {String} value 
     */
    constructor(name: string, value: string | null) {
        this.name = name;
        this.value = value;
    }
}

export { Profile, Category, Item, Field };
export type { IIdTitle };