const child_process = require('child_process');
const fs = require('fs');
const path = require('path');
const cdp = require('chrome-remote-interface');
const cl = require('chrome-launcher');

const delay = (ms) => {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
};

const launchChrome = async (url) => {
    const chrome = await cl.launch({
        startingUrl: url
    });

    return chrome;
}

const launchBrowser = async (url) => {
    //require('edge-diagnostics-adapter');
    const outFile = fs.openSync(path.join(process.cwd(), 'edge-out.log'), 'a');
    const errFile = fs.openSync(path.join(process.cwd(), 'edge-err.log'), 'a');
    const child = child_process.spawn('C:\\Program Files\\nodejs\\node.exe', ['node_modules\\edge-diagnostics-adapter\\out\\src\\edgeAdapter.js', '--servetools', '--diagnostics'], {
        detached: true,
        stdio: ['ignore', outFile, errFile]
    });

    child.unref();

    await delay(5000);

    const outFile2 = fs.openSync(path.join(process.cwd(), 'edge-out.log'), 'a');
    const errFile2 = fs.openSync(path.join(process.cwd(), 'edge-err.log'), 'a');

    const child2 = child_process.spawn(`start microsoft-edge:${url === 'about:blank' ? '' : url}`, [], {
        detached: true,
        shell: true,
        stdio: ['ignore', outFile2, errFile2]
    });

    child2.unref();

    return {
        port: 9222
    };
}

const startToListen = async (id, port) => {
    cdp({ port, target: id }, async (client) => {
        // extract domains
        const { Network, Page } = client;
        // setup handlers
        Network.requestWillBeSent((params) => {
            console.log(params.request.url);
        });

        Network.responseReceived(async (params) => {
            console.log('getResponse!!');
            try {
                const { body, base64Encoded } = await Network.getResponseBody({ requestId: params.requestId });
                const encoding = base64Encoded ? 'base64' : 'utf8';

                content = body;
                console.log(content.toString());
            } catch (err) {
                console.error(`Body requested error for request ${params.requestId}`)
            }
        });
        Page.loadEventFired(async () => {
            const { DOM } = client;
            console.log('load!!');
            // DOM.getDocument need a parameter depth
            // if depth is -1 then getDocument has to return the whole tree
            // https://chromedevtools.github.io/devtools-protocol/tot/DOM/
            // Right now, getDocuments return just 1 or 2 levels.
            const document = await DOM.getDocument({ depth: -1 });

            //html should have content
            const html = await DOM.getOuterHTML({ nodeId: document.root.nodeId });
            //html have the right value
            const html2 = await DOM.getOuterHTML({ nodeId: document.root.children[1].nodeId });
            const html3 = await DOM.getOuterHTML({ nodeId: document.root.children[0].nodeId });
            const elements = await DOM.querySelectorAll({ nodeId: document.root.nodeId, selector: 'div' });
            console.log('aham!!');
            client.close();
        });
        // enable events then start!
        try {

            await delay(1000);

            await Promise.all([
                Network.clearBrowserCache(),
                Network.setCacheDisabled({ cacheDisabled: true })
                // Network.requestWillBeSent(this.onRequestWillBeSent.bind(this)),
                // Network.responseReceived(this.onResponseReceived.bind(this)),
                // Network.loadingFailed(this.onLoadingFailed.bind(this))
            ]);
            // await delay(1000);

            await delay(1000);
            //right now Page.navigation is not reached because network.enable never return anything.
            await Promise.all([
                Network.enable(),
                Page.enable()
            ]);

            console.log('navigating!');
            Page.navigate({ url: 'http://edge.ms' });
            console.log('after navigate');
        } catch (err) {
            console.error(err);
            client.close();
        }
    }).on('error', (err) => {
        // cannot connect to the remote endpoint
        console.error(err);
    });
}

const run = async () => {
    const browserInfo = await launchBrowser('https://sonarwhal.com');

    // workaround to give time to the edge to load the tab
    // retries seems the proper solution    
    await delay(3000);

    cdp.List({ port: browserInfo.port }, function (err, targets) {
        if (!err) {
            const tab = targets.filter((target) => {
                return !target.url.startsWith('chrome-extension');
            })
            console.log(targets);
            startToListen(tab[0], browserInfo.port);
        }
    });
}

run();


