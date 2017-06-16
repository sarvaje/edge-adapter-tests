const child_process = require('child_process');
const fs = require('fs');
const path = require('path');
const cdp = require('chrome-remote-interface');

const delay = (ms) => {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
};

const launchBrowser = async (url) => {
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

    return child2;
}

const startToListen = async (id) => {
    cdp({target: id} , async (client) => {
        // extract domains
        const { Network, Page } = client;
        // setup handlers
        Network.requestWillBeSent((params) => {
            console.log(params.request.url);
        });
        Page.loadEventFired(async () => {
            const { DOM } = client;

            // const elements = await DOM.getDocument({ depth: -1 });
            const document = await DOM.getDocument();
            const elements = await DOM.querySelectorAll({ nodeId: document.root.nodeId, selector: 'div' });
            console.log('aham!!');
            // client.close();
        });
        // enable events then start!
        try {

            await delay(1000);

            //right now Page.navigation is not reached because network.enable never return anything.
            await Promise.all([
                Network.enable(),
                Page.enable()
            ]);

            Page.navigate({ url: 'http://edge.ms' })
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
    await launchBrowser('about:blank'); 

    // workaround to give time to the edge to load the tab
    // retries seems the proper solution    
    await delay(1000);

    cdp.List(function (err, targets) {
        if (!err) {
            console.log(targets);
            startToListen(targets[0].id);
        }
    });        
}

run();


