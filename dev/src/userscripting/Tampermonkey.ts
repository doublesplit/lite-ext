export function registerMenuCommands() {
    const links = [
        { name: '\uD83D\uDF02 Adverisement: Play cell games on Delt.io', url: 'https://delt.io' },
        { name: '\uD83D\uDDAD Contact: Delta Discord', url: 'https://bit.ly/3RXQXQd' }
    ];
    try {
        links.forEach((link) => GM.registerMenuCommand(link.name, () => (window.location.href = link.url)));
    } catch (e) {}
}

export function registerCheckUpdates() {
    GM.registerMenuCommand(`Version: ${GM.info.script.version} - Check for updates`, checkUpdates);
}

export function checkUpdates() {
    const url = GM.info.scriptUpdateURL;
    if (!url) return alert('⛔ Error:\nNo update URL found!');
    const version2int = (x = '0') => x.split('.').reduce((n, c, i, a) => n + parseInt(c) * 100 ** (a.length - i - 1), 0);
    const req = new Promise<GM.Response<string>>((r) => GM.xmlHttpRequest({ method: 'GET', url: url, onload: r }));
    req.then((res) => {
        const matches = /\/\/\s*@version\s*(\S+)/im.exec(res.responseText);
        if (!matches) return alert('⛔ Error:\nNo version found!');
        const remoteVersion = version2int(matches[1]);
        const localVersion = version2int(GM.info.script.version);
        if (remoteVersion > localVersion) {
            const msg = `🔔 New version available: ${matches[1]}\n\nDo you want to update?`;
            if (confirm(msg)) {
                const installer = window.open(url, '_blank');
                const i = setInterval(() => {
                    if (!installer.closed) return;
                    clearInterval(i);
                    location.reload();
                }, 100);
            }
        } else {
            alert('👍 You are using the latest version!');
        }
    }).catch((e) => {
        console.error(e);
        alert('⛔ Error: Cant fetch update info!\n' + e);
    });
}

export function isGM() {
    return typeof GM !== 'undefined' && GM;
}
