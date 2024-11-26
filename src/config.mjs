import fs from "node:fs/promises";
import yaml from "js-yaml";

const CONFIG_FILE = "config/config.yaml";

export default class Config {
	#data;

	constructor() {
		this.#data = {};
	}

	async init() {
		try {
			this.#data = await fs.readFile(CONFIG_FILE, "utf8").then((data) => yaml.load(data));
			this.verify();
		} catch (err) {
			console.error(err);
		}
		this.#watch();
	}

	async #watch() {
		console.debug("Watching for changes in the config file");
		try {
			const watcher = fs.watch(CONFIG_FILE, { persistent: true });
			for await (const _ of watcher) {
				console.debug("Config file has been updated");
				const newConfig = await fs
					.readFile(CONFIG_FILE, "utf8")
					.then((data) => yaml.load(data))
					.catch((err) => {
						console.error(`Is the config file valid? ${err}\n`);
					});
				if (this.verify(newConfig) && JSON.stringify(newConfig) !== JSON.stringify(this.#data)) {
					console.info("Updated config loaded");
					this.#data = newConfig;
				}
			}
		} catch (err) {
			console.error(err);
		}
	}

	verify(config = this.#data) {
		try {
			if (!config.steam || !config.steam.username || !config.steam.password) {
				console.error("Please fill in your steam username and password in config.yaml");
				process.exit(1);
			}
			return true;
		} catch (err) {
			console.error(`Is the config file valid? ${err}\n`);
			return false;
		}
	}

	// returns the branch configured for the given appid or the default branch
	getBranch(appid) {
		return this.#data.apps[appid]?.branch || "public";
	}

	getApp(appid) {
		if (appid) {
			if (!this.#data.apps[appid]) {
				return null;
			}
			return this.#data.apps[appid];
		}
		return this.#data.apps;
	}

	getSteamLogins() {
		return {
			accountName: this.#data?.steam?.username,
			password: this.#data?.steam?.password,
		};
	}
}
