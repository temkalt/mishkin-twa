import localtunnel from 'localtunnel';

async function startTunnel() {
  try {
    const tunnel = await localtunnel({ port: 5173 });
    console.log(`\n=== TUNNEL READY ===\nyour url is: ${tunnel.url}\n====================\n`);

    tunnel.on('close', () => {
      console.log('Tunnel closed, restarting...');
      setTimeout(startTunnel, 1000);
    });

    tunnel.on('error', (err) => {
      console.error('Tunnel error:', err);
    });

  } catch (err) {
    console.error('Failed to start tunnel:', err);
    setTimeout(startTunnel, 2000);
  }
}

startTunnel();
