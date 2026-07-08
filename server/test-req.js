const http = require('http');

const data = JSON.stringify({
  url: 'https://github.com/john-git7/DRM.git',
  embeddingModel: 'gemini-embedding-001'
});

const options = {
  hostname: 'localhost',
  port: 5001,
  path: '/api/repos/index',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, res => {
  console.log(`statusCode: ${res.statusCode}`);

  res.on('data', d => {
    console.log(`Received data chunk of length: ${d.length}`);
    if (d.length < 500) {
      console.log(d.toString());
    }
  });

  res.on('end', () => {
    console.log('Response ended.');
  });
});

req.on('error', error => {
  console.error(error);
});

req.write(data);
req.end();
