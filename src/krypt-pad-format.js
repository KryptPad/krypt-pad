//import { ref } from 'vue';

/**
 * A profile is the top most entity. It contains all the categories the user defines.
 */
class Profile {
    constructor() {
        this.categories = [];
    }
}

/**
 * Category for organizing items.
 */
class Category {
    constructor(name) {
        this.name = name;
        this.items = [];
    }


}

export { Profile, Category };