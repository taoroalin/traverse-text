const http = require('http')
const fs = require('fs');

http.createServer((req, res) => {
  const match = req.url.match(/\/(?:(putedn)|(getedn))\/([a-z]+)\/?/);
  if (match) {
    if (match[1]) {
      let body = [];
      req.on('data', (chunk) => {
        body.push(chunk);
      }).on('end', () => {
        body = Buffer.concat(body).toString();
        // at this point, `body` has the entire request body stored in it as a string
        fs.writeFile(`user-data/${match[3]}.edn`, body, (err) => {
          res.write('putted');
          res.end()
        })
      });
    } else if (match[2]) {
      fs.readFile(`user-data/${match[3]}.edn`, (err, data) => {
        res.write(data)
        res.end()
      })
    }
  } else {
    console.log(match)
    res.write('error');
    res.end()
  }
}).listen(3000)

// app.get('/getedn/[a-z]+', (req, res) => {
//   console.log(req.url)

// })

// app.put('/putedn/[a-z]+', (req, res) => {
// })

// app.listen(port, () => {
//   console.log(`Example app listening at http://localhost:${port}`)
// })