import Health from 'hyperhealth';

// Gets Health
export default function monitor(archive) {
  const health = Health(archive);

  // Will fire every 1 second
  setInterval(() => {
    const data = health.get();
    console.log(data.peers.length, 'total peers');
    console.log(data.bytes, 'total bytes');
    console.log(data.blocks, 'total blocks');
    console.log(`Peer 1 Downloaded ${(data.peers[0].have / data.peers[0].blocks) * 100}%`);
  }, 1000);
}
