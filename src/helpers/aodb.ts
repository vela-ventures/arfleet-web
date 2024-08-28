export class AODB {
    data: Map<string, string>;
    initialized: boolean;

    constructor() {
        this.data = new Map();
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;
        this.initialized = true;

        // grab from local storage
        const data = localStorage.getItem("aodb");
        if (data) {
            const parsedData = JSON.parse(data);
            this.data = new Map(Object.entries(parsedData));
        }
    }

    has(key: string) {
        if (!this.initialized) throw new Error("AODB not initialized");
        return this.data.has(key);
    }

    get(key: string, defaultValue: string) {
        if (!this.initialized) throw new Error("AODB not initialized");
        if (this.data.has(key)) {
            return this.data.get(key);
        }
        return defaultValue;
    }

    async set(key: string, value: string) {
        if (!this.initialized) throw new Error("AODB not initialized");
        this.data.set(key, value);
        localStorage.setItem("aodb", JSON.stringify(Object.fromEntries(this.data)));
    }

    async reset() {
        this.data.clear();
        localStorage.removeItem("aodb");
        console.log("AODB reset");
    }
}