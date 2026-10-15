const net = require('node:net');

// Loopback-only SMTP fixture. No credentials, DNS lookup or external delivery.
async function startSmtpFixture() {
  const state = { mode: 'accept', messages: [], connections: 0 };
  const sockets = new Set();
  const server = net.createServer(socket => {
    sockets.add(socket); state.connections++;
    let buffer = '', data = null, recipient = '';
    socket.setEncoding('utf8');
    socket.on('error', () => {});
    socket.on('close', () => sockets.delete(socket));
    socket.write('220 localhost SGTech isolated QA\r\n');
    socket.on('data', chunk => {
      buffer += chunk;
      for (;;) {
        const end = buffer.indexOf('\r\n');
        if (end < 0) break;
        const line = buffer.slice(0, end); buffer = buffer.slice(end + 2);
        if (data !== null) {
          if (line !== '.') { data.push(line.startsWith('..') ? line.slice(1) : line); continue; }
          state.messages.push({ recipient, content: data.join('\r\n'), mode: state.mode }); data = null;
          if (state.mode === 'lost') { socket.destroy(); return; }
          socket.write(state.mode === 'temporary' ? '451 4.3.0 Try later\r\n' : '250 2.0.0 Accepted by isolated QA\r\n');
        } else if (/^(EHLO|HELO) /i.test(line)) socket.write('250-localhost\r\n250 8BITMIME\r\n');
        else if (/^MAIL FROM:/i.test(line)) socket.write('250 2.1.0 Sender accepted\r\n');
        else if (/^RCPT TO:/i.test(line)) {
          recipient = line.match(/<([^>]+)>/)?.[1] || '';
          socket.write(state.mode === 'permanent' ? '550 5.1.1 Rejected by isolated QA\r\n' : '250 2.1.5 Recipient accepted\r\n');
        } else if (/^DATA$/i.test(line)) { data = []; socket.write('354 End with a single dot\r\n'); }
        else if (/^QUIT$/i.test(line)) { socket.end('221 Bye\r\n'); return; }
        else if (/^(RSET|NOOP)$/i.test(line)) socket.write('250 OK\r\n');
        else socket.write('500 Unsupported fixture command\r\n');
      }
    });
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return { state, options: { host: '127.0.0.1', port: server.address().port, secure: false, ignoreTLS: true, connectionTimeout: 3000, greetingTimeout: 3000, socketTimeout: 3000 },
    close: () => new Promise(resolve => { for (const socket of sockets) socket.destroy(); server.close(resolve); }),
  };
}
module.exports = { startSmtpFixture };
