
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

    // Create the category objects
    for (const c of profileObject.categories) {
        const category = new Category(c.title);
        category.id = c.id;
        // Add category to profile
        profile.categories.push(category);

    }

    return profile;

};

/**
 * Category for organizing items.
 */
class Category {
    constructor(title) {
        this.title = title;
        this.id = crypto.randomUUID();

    }

}

/**
 * Wrapper for user defined data to encrypt. Contains fields and notes
 */
class Item{
    constructor(categoryId, title){
        this.title = title;
        this.notes = null;
        this.id = crypto.randomUUID();
        // Link to a category
        this.categoryId = categoryId;

    }

}

export { Profile, Category, Item };