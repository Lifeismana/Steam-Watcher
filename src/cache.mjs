import fs from "fs/promises";

const CACHE_FILE = "config/cache.json";

export default class Cache {
    constructor() {
        this.data = { apps: {} };
    }

    async init() {
        try {
            this.data = await fs.readFile(CACHE_FILE, "utf8").then((data) => JSON.parse(data));
        } catch (err) {
            if (err.code === "ENOENT") {
                console.info("Cache file not found, creating one");
                this.#write();
            } else {
                console.error(err);
                process.exit(1);
            }
        }
    }

    async #write() {
        try {
            await fs.writeFile(CACHE_FILE, JSON.stringify(this.data));
        } catch (err) {
            console.error(err);
        }
    }

    is_buildid_updated(appid, buildid) {
        if (!this.data.apps[appid].buildid || this.data.apps[appid].buildid !== buildid) {
            this.data.apps[appid].buildid = buildid;
            this.#write();
            return true;
        }
        return false;
    }
}
