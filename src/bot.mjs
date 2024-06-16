#!/usr/bin/env node

import SteamUser from "steam-user";

import Config from "./config.mjs";
import Cache from "./cache.mjs";

const client = new SteamUser();
const config = new Config();
await config.init();
const cache = new Cache();
await cache.init();

const sendWebhook = async (data, appid) => {
    try {
        let response;
        switch (data.type) {
            case "discord":
                response = await fetch(data.url, {
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
                response = await fetch(`https://api.github.com/repos/${data.repo}/actions/workflows/${data.workflow_id}/dispatches`, {
                    method: "POST",
                    headers: {
                        Accept: "application/vnd.github.everest-preview+json",
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${data.access_token}`,
                    },
                    body: JSON.stringify({
                        ref: data.branch || "main",
                    }),
                });
                break;
            default:
                console.log("Unknown webhook type");
        }
        if (response.status < 200 || response.status >= 300) {
            console.error(`Failed to send webhook: ${response.status} ${response.statusText} ${response.url}`);
        }
    } catch (err) {
        console.error(err);
    }
};

client.setOptions({
    enablePicsCache: true,
    changelistUpdateInterval: 10000,
    machineIdType: SteamUser.EMachineIDType.PersistentRandom,
});

client.logOn(config.getSteamLogins());

const initAfterLogin = async () => {
    Object.keys(config.getApp()).forEach(async (appid) => {
        // for some reason getProductInfo only times out
        // hopefully waiting 30s after boot is enough to make picsCache never be empty
        // if (!client.picsCache.apps[appid]) {
        //     console.debug("Product info fetching");
        //     await client.getProductInfo([appid], []);
        //     console.debug("Product info fetched");
        // }
        if (!client.picsCache.apps[appid]?.appinfo) {
            console.info(`App ${appid} is not available`);
            return;
        }
        if (!client.picsCache.apps[appid].appinfo?.depots?.branches[config.getBranch(appid)]) {
            console.info(`Branch ${config.getBranch(appid)} is not available for app ${appid}`);
            return;
        }
        if (cache.is_buildid_updated(appid, client.picsCache.apps[appid].appinfo.depots.branches[config.getBranch(appid)].buildid)) {
            config.getApp(appid)?.webhooks.forEach((webhook) => {
                sendWebhook(webhook, appid);
            });
        }
    });
};

client.on("loggedOn", () => {
    console.info("Logged into Steam");
    client.setPersona(SteamUser.EPersonaState.Online);
    setTimeout(initAfterLogin, 30000);
});

client.on("error", (err) => {
    console.error(err);
});

client.on("appUpdate", (appid, data) => {
    console.info(`App ${appid} has been updated`);
    if (!config.getApp(appid)) {
        console.info(`App ${appid} is not being monitored`);
        return;
    }
    if (
        cache.is_buildid_updated(appid, data.appinfo.depots.branches[config.getBranch(appid)].buildid) ||
        (client.picsCache.apps[appid]?.appinfo?.depots?.branches[config.getBranch(appid)] &&
            data.appinfo?.depots?.branches[config.getBranch(appid)] &&
            client.picsCache.apps[appid].appinfo.depots.branches.public.buildid !== data.appinfo.depots.branches.public.buildid)
    ) {
        config.getApp(appid)?.webhooks.forEach((webhook) => {
            sendWebhook(webhook, appid);
        });
    }
});
