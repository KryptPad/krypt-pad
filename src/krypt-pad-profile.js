
/**
 * A profile is the top most entity. It contains all the categories the user defines.
 */
class Profile {
    constructor() {
        this.categories = [];
        this.items = [];
    }

}

/**
 * Creates a profile from a json string
 * @param {String} json 
 * @returns 
 */
Profile.from = function (json) {
    if (!json) { return; }

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
        console.log(item)
        
        // Add fields to the item
        for (const field of i.fields) {
            item.fields.push(new Field(field.name, field.value));
        }

        // Add category to profile
        profile.items.push(item);

    }

    return profile;

};

/**
 * Category for organizing items.
 */
class Category {
    /**
     * Creates a new category. If no id is passed, a new one is generated.
     * @param {String} id 
     * @param {String} title 
     */
    constructor(id, title) {
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
class Item {
    /**
     * Creates a new item. If no id is passed, a new one is generated.
     * @param {String} id 
     * @param {String} categoryId 
     * @param {String} title 
     */
    constructor(id, categoryId, title) {
        if (!id) {
            this.id = crypto.randomUUID();
        } else {
            this.id = id;
        }
        this.title = title || 'Untitled';
        this.notes = null;
        this.starred = false;
        // Link to a category
        this.categoryId = categoryId;
        // Fields
        this.fields = [];

    }

}

/**
 * User defined fields for items
 */
class Field {
    /**
     * Creates a new item.
     * @param {String} name 
     * @param {String} value 
     */
    constructor(name, value) {
        this.name = name;
        this.value = value;
    }
}

export { Profile, Category, Item, Field };