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
    if (config?.apps[appid] === undefined) {
        console.info("App " + app + " is not being monitored");
        return;
    }
    config.apps[appid].webhooks.forEach((webhook) => {
        sendWebhook(webhook, appid);
    });
});

const sendWebhook = async (config, appid) => {
    try {
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
                await fetch(`https://api.github.com/repos/${config.repo}/dispatches`, {
                    method: "POST",
                    headers: {
                        Accept: "application/vnd.github.everest-preview+json",
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${config.access_token}`,
                    },
                });
            default:
                console.log("Unknown webhook type");
        }
    } catch (err) {
        console.error(err);
    }
};
