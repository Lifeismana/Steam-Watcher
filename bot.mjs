#!/usr/bin/env node

import SteamUser from "steam-user";
import fs from "fs/promises";
import yaml from "js-yaml";

let client = new SteamUser();

const config = await fs
    .readFile("config.yaml", "utf8")
    .then((data) => {
        return yaml.load(data);
    })
    .catch((err) => {
        console.error(`Is the config file missing? ${err}\n`);
        process.exit(1);
    });

const cache = await fs.readFile("cache.json", "utf8").catch(() => {
    console.info("Cache file not found, creating one");
    const cache = { app: {} };
    fs.writeFile("cache.json", JSON.stringify(cache));
    return cache;
});

client.setOptions({
    enablePicsCache: true,
    changelistUpdateInterval: 10000,
});

if (config?.steam.username === undefined || config?.steam.password === undefined) {
    console.error("Please fill in your steam username and password in config.yaml");
    process.exit(1);
}

client.logOn({
    accountName: config.steam.username,
    password: config.steam.password,
});

client.on("loggedOn", () => {
    console.info("Logged into Steam");
    client.setPersona(SteamUser.EPersonaState.Online);
});

client.on("error", (err) => {
    console.log(err);
});

client.on("appUpdate", (appid, data) => {
    console.debug("App " + appid + " has been updated");
    console.debug(data);
    console.debug(data.appinfo.depots.branches.public.buildid);
    if (config?.apps[appid] === undefined) {
        console.info("App " + appid + " is not being monitored");
        return;
    }
    console.debug(data);
    if (picsCache.app[appid].appinfo.depots.branches.public.buildid === data.appinfo.depots.branches.public.buildid) {
        config.apps[appid].webhooks.forEach((webhook) => {
            sendWebhook(webhook, appid);
        });
    }
});

const sendWebhook = async (config, appid) => {
    try {
        console.debug(config);
        switch (config.type) {
            case "discord":
                await fetch(config.url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        content: `App ${app} has been updated`,
                    }),
                });
                break;
            case "github":
                const resp = await fetch(`https://api.github.com/repos/${config.repo}/actions/workflows/${config.workflow_id}/dispatches`, {
                    method: "POST",
                    headers: {
                        Accept: "application/vnd.github.everest-preview+json",
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${config.access_token}`,
                    },
                    body: JSON.stringify({
                        ref: config.branch || "main",
                    }),
                });
                console.debug(resp);
                break;
            default:
                console.log("Unknown webhook type");
        }
    } catch (err) {
        console.error(err);
    }
};

const configWatcher = () => {
    console.debug("Watching for changes in the config file");
    fs.watch("config.yaml", { persistent: true }, async () => {
        console.info("Config file has been updated");
        const newConfig = await fs
            .readFile("config.yaml", "utf8")
            .then((data) => yaml.load(data))
            .catch((err) => {
                console.error(`Is the config file valid? ${err}\n`);
                return;
            });
        if (newConfig !== config) {
            console.info("Updated config loaded");
            config = newConfig;
        }
    });
};

configWatcher();
