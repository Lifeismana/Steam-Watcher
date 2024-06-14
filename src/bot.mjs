#!/usr/bin/env node

import SteamUser from "steam-user";
import fs from "fs/promises";

import Config from "./config";

const sendWebhook = async (data, appid) => {
    try {
        console.debug(data);
        switch (data.type) {
            case "discord":
                await fetch(data.url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        content: `App ${appid} has been updated`,
                    }),
                });
                break;
            case "github":
                console.debug(await fetch(`https://api.github.com/repos/${data.repo}/actions/workflows/${data.workflow_id}/dispatches`, {
                    method: "POST",
                    headers: {
                        Accept: "application/vnd.github.everest-preview+json",
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${data.access_token}`,
                    },
                    body: JSON.stringify({
                        ref: data.branch || "main",
                    }),
                }));
                break;
            default:
                console.log("Unknown webhook type");
        }
    } catch (err) {
        console.error(err);
    }
};



const client = new SteamUser();
const config = new Config();
await config.init();

// eslint-disable-next-line no-unused-vars
const cache = await fs.readFile("cache.json", "utf8").catch(() => {
    console.info("Cache file not found, creating one");
    const tmp = { app: {} };
    fs.writeFile("cache.json", JSON.stringify(tmp));
    return tmp;
});

client.setOptions({
    enablePicsCache: true,
    changelistUpdateInterval: 10000,
});

client.logOn({
    accountName: config.data.steam.username,
    password: config.data.steam.password,
});

client.on("loggedOn", () => {
    console.info("Logged into Steam");
    client.setPersona(SteamUser.EPersonaState.Online);
});

client.on("error", (err) => {
    console.error(err);
});

client.on("appUpdate", (appid, data) => {
    console.debug(`App ${  appid  } has been updated`);
    console.debug(data);
    console.debug(data.appinfo.depots?.branches?.public?.buildid);
    if (!config.data?.apps[appid]) {
        console.info(`App ${  appid  } is not being monitored`);
        return;
    }
    console.debug(data);
    console.debug(client.picsCache.apps[appid]);
    if (
        client.picsCache.apps[appid]?.appinfo?.depots?.branches[config.data.apps[appid].branch || "public"] &&
        data.appinfo?.depots?.branches[config.data.apps[appid].branch || "public"] &&
        client.picsCache.apps[appid].appinfo.depots.branches.public.buildid !== data.appinfo.depots.branches.public.buildid
    ) {
        config.data.apps[appid].webhooks.forEach((webhook) => {
            sendWebhook(webhook, appid);
        });
    }
});


