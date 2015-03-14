var http = require('http');
var path = require('path');
var async = require('async');

var test = require('tap').test;
var filed = require('filed');
var director = require('director');

var browser = require('../start-browser.js');
var reset = require('../../steer-reset.js');

// Create a testing server
var router = new director.http.Router();
var server = http.createServer();
var chrome;

function fixturePath(name) {
    return path.resolve(__dirname, '..', 'fixture', 'http-' + name + '.html');
}

function writeSessionData(host, name, callback) {
  router.get('/' + name + '/set', function() {
    filed(fixturePath(name)).pipe(this.res);
  });

  async.parallel({
    status: function(done) {
      chrome.inspector.Console.on('messageAdded', function removeMe(message) {
        if (message.message.level === 'log') {
          chrome.inspector.Console.removeListener('messageAdded', removeMe);
          done(null, JSON.parse(message.message.parameters[0].value));
        }
      });
    },
    navigate: function(done) {
      chrome.inspector.Page.navigate(host + '/' + name + '/set', done);
    },
    page: function(done) {
      chrome.inspector.Page.once('frameNavigated', function(info) {
        done(null, info.frame);
      });
    }
  }, function(err, info) {
    if (err) return callback(err);

    callback(null, info.page, info.status);
  });
}

function readSessionData(host, name, callback) {
  var frame;

  router.get('/' + name + '/get', function() {
    this.res.end('done');
  });

  async.parallel({
    load: function(done) {
      chrome.inspector.Page.once('loadEventFired', function() {
        done(null);
      });
    },
    navigate: function(done) {
      chrome.inspector.Page.navigate(host + '/' + name + '/get', done);
    },
    page: function(done) {
      chrome.inspector.Page.once('frameNavigated', function(info) {
        done(null, info.frame);
      });
    }
  }, function(err, info) {
    if (err) return callback(err);

    callback(null, info.page);
  });
}

function prepear(callback) {
  server.on('request', router.dispatch.bind(router));
  server.listen(0, function() {
    var host = 'http://127.0.0.1:' + server.address().port;

    chrome = browser({ permissions: ['browsingData'] }, function() {

      chrome.inspector.Page.enable(function (err) {
        if (err) return callback(err);

        chrome.inspector.Console.enable(function(err) {
          if (err) return callback(err);

          chrome.inspector.IndexedDB.enable(function(err) {
            if (err) return callback(err);

            chrome.inspector.Database.enable(function(err) {
              if (err) return callback(err);

              chrome.inspector.DOMStorage.enable(function(err) {
                if (err) return callback(err);

                chrome.inspector.FileSystem.enable(function(err) {
                  if (err) return callback(err);

                  callback(null, host);
                });
              });
            });
          });
        });
      });
    });
  });
}

prepear(function(err, host) {
  test('cookies set by browser', function(t) {

    // Create a data object pointing to tomorrow
    // The HTTP supports only to nearest second
    var now = 1000 * Math.floor(Date.now() / 1000);
    var aDay = 1000 * 60 * 60 * 24;
    var nextDay = new Date(now + aDay);

    // This url will set a cookie and a session
    router.get('/cookies/set', function() {

      this.res.setHeader('Set-Cookie', [
        'permanent=stored; Expires=' + nextDay.toUTCString(),
        'temporary=stored'
      ]);

      this.res.end();
    });

    // Naviagte the browser to a page where a cookie and a session
    // will be set.
    chrome.inspector.Page.navigate(host + '/cookies/set', function(err) {
      t.equal(err, null);

      chrome.inspector.Page.once('loadEventFired', function () {
        chrome.inspector.Page.getCookies(function(err, data) {
          t.equal(err, null);

          // check that cookies where indead stored by the browser
          t.deepEqual(data, {
            cookies: [{
              name: 'permanent',
              value: 'stored',
              domain: '127.0.0.1',
              path: '/cookies',
              // make expires flexible and check range later
              expires: data.cookies[0].expires,
              size: 15,
              httpOnly: false,
              secure: false,
              session: false
            }, {
              name: 'temporary',
              value: 'stored',
              domain: '127.0.0.1',
              path: '/cookies',
              expires: 0,
              size: 15,
              httpOnly: false,
              secure: false,
              session: true
            }]
          });

          // check that the expires is within the allowed range
          t.ok(
            data.cookies[0].expires >= (nextDay.getTime() - 1000) &&
            data.cookies[0].expires <= (nextDay.getTime() + 1000),
            'expires is within allowed range'
          );

          t.end();
        });
      });
    });
  });

  test('cookies removed by resetState', function(t) {
    var cookies = null;

    // returns all cookies there stil exists
    router.get('/cookies/get', function() {
      cookies = this.req.headers.cookie;
      this.res.end();
    });

    // Remove all website data
    reset(chrome, function(err) {
      t.equal(err, null);

      // Naviagte the browser to a page where a boolean is returned
      chrome.inspector.Page.navigate(host + '/cookies/get', function(err) {
        t.equal(err, null);

        chrome.inspector.Page.once('loadEventFired', function() {

          // the server didn't rescive any cookies
          t.equal(cookies, undefined);

          // Get cookies from the browser cache
          chrome.inspector.Page.getCookies(function(err, data) {
            t.equal(err, null);

            // The browser has no cookies
            t.deepEqual(data, {
                cookies: []
            });

            t.end();
          });
        });
      });
    });
  });

  /*
  //TODO: reactivate this once the bug is found and solved
  test('local storage data imported', function(t) {
    writeSessionData(host, 'local-storage', function(err, page, status) {
      t.equal(err, null);
      t.equal(status, 'done');
    });

    chrome.inspector.DOMStorage.once('domStorageItemAdded', function(info) {
      console.log('test:', info.storage.id);

      chrome.inspector.DOMStorage.getDOMStorageItems(
        info.storage.id,
        function(err, info) {
          t.equal(err, null);
          console.log(info.entries);
          t.equal(info.entries.length, 1);
          t.end();
        }
      );
    });
  });

  test('local storage data removed', function(t) {
    reset(chrome, function(err) {
      t.equal(err, null);

      writeSessionData(host, 'local-storage',
        function(err, page, status) {
          t.equal(err, null);
          t.equal(status, 'done');
        }
      );

      chrome.inspector.DOMStorage.once('domStorageItemAdded', function(info) {
        console.log('test:', info.storage.id);

        chrome.inspector.DOMStorage.getDOMStorageItems(
          info.storage.id,
          function(err, info) {
            t.equal(err, null);
            console.log(info.entries);
            t.equal(info.entries.length, 1);
            t.end();
          }
        );
      });
    });
  });
  */

  test('local storeage deactived', function(t) {
    writeSessionData(host, 'local-storage', function(err, page, status) {
      t.equal(err, null);
      t.equal(status, 'blocked');
      t.end();
    });
  });

  /*
  //TODO: reactivate this once the bug is found and solved
  test('session storage data imported', function(t) {
    writeSessionData(host, 'session-storage', function(err, page, status) {
      t.equal(err, null);
      t.equal(status, 'done');
    });

    chrome.inspector.DOMStorage.once('addDOMStorage', function(info) {
      console.log('test:', info.storage.id);

      chrome.inspector.DOMStorage.getDOMStorageEntries(
        info.storage.id,
        function(err, info) {
          t.equal(err, null);
          console.log(info.entries);
          t.equal(info.entries.length, 1);
          t.end();
        }
      );
    });
  });

  test('session storage data removed', function(t) {
    chrome.plugins.resetState(function(err) {
      t.equal(err, null);

      writeSessionData(host, 'session-storage',
        function(err, page, status) {
          t.equal(err, null);
          t.equal(status, 'done');
        }
      );

      chrome.inspector.DOMStorage.once('addDOMStorage', function(info) {
        console.log('test:', info.storage.id);

        chrome.inspector.DOMStorage.getDOMStorageEntries(
          info.storage.id,
          function(err, info) {
            t.equal(err, null);
            console.log(info.entries);
            t.equal(info.entries.length, 1);
            t.end();
          }
        );
      });
    });
  });
  */

  test('session storeage deactived', function(t) {
    writeSessionData(host, 'session-storage', function(err, page, status) {
      t.equal(err, null);
      t.equal(status, 'blocked');
      t.end();
    });
  });

  test('file system API data imported', function(t) {
    writeSessionData(host, 'file-system', function(err, page, status) {
      t.equal(err, null);
      t.equal(status, 'done');

      chrome.inspector.FileSystem.requestFileSystemRoot(
        page.securityOrigin,
        'temporary',
        function(err, drive) {
          t.equal(err, null);

          chrome.inspector.FileSystem.requestDirectoryContent(
            drive.root.url,
            function(err, directory) {
              t.equal(err, null);
              t.equal(directory.entries.length, 1);
              t.end();
            }
          );
        }
      );
    });
  });

  test('file system API data removed', function(t) {
    reset(chrome, function(err) {
      t.equal(err, null);

      writeSessionData(host, 'file-system', function(err, page, status) {
        t.equal(err, null);
        t.equal(status, 'done');

        chrome.inspector.FileSystem.requestFileSystemRoot(
          page.securityOrigin,
          'temporary',
          function(err, drive) {
            t.equal(err, null);

            chrome.inspector.FileSystem.requestDirectoryContent(
              drive.root.url,
              function(err, directory) {
                t.equal(err, null);
                t.equal(directory.entries.length, 1);
                t.end();
              }
            );
          }
        );
      });
    });
  });

  test('web SQL API data imported', function(t) {
    writeSessionData(host, 'web-sql', function(err, page, status) {
      t.equal(err, null);
      t.equal(status, 'done');
    });

    chrome.inspector.Database.once('addDatabase', function(info) {

      chrome.inspector.Database.executeSQL(
        info.database.id,
        'SELECT * FROM todo',
        function(err, result) {
          t.equal(err, null);
          t.deepEqual(result.columnNames, [
            'ID', 'todo', 'added_on'
          ]);

          t.equal(result.values.length, 3);

          t.end();
        }
      );
    });
  });

  test('web SQL API data removed', function(t) {
    reset(chrome, function(err) {
      t.equal(err, null);

      writeSessionData(host, 'web-sql', function(err, page, status) {
        t.equal(err, null);
        t.equal(status, 'done');
      });

      chrome.inspector.Database.once('addDatabase', function(info) {

        chrome.inspector.Database.executeSQL(
          info.database.id,
          'SELECT * FROM todo',
          function(err, result) {
            t.equal(err, null);
            t.deepEqual(result.columnNames, [
                'ID', 'todo', 'added_on'
            ]);

            // In case webSQL clear dosn't work, this will be 6
            t.equal(result.values.length, 3);

            t.end();
          }
        );
      });
    });
  });

  test('indexed DB data imported', function(t) {
    writeSessionData(host, 'indexed-db', function(err, page, status) {
      t.equal(err, null);
      t.equal(status, 'done');

      chrome.inspector.IndexedDB.requestDatabaseNames(
        page.securityOrigin,
        function(err, result) {
          t.equal(err, null);
          t.deepEqual(result, {
            "databaseNames" : ["todos"]
          });
          t.end();
        }
      );
    });
  });

  test('indexed DB data removed', function(t) {
    reset(chrome, function(err) {
      t.equal(err, null);

      readSessionData(host, 'indexed-db', function(err, page) {
        t.equal(err, null);

        chrome.inspector.IndexedDB.requestDatabaseNames(
          page.securityOrigin,
          function(err, result) {
            t.equal(err, null);
            t.deepEqual(result, {
              "databaseNames" : []
            });
            t.end();
          }
        );
      });
    });
  });

  test('close chromium', function(t) {
    chrome.close(function() {
      server.close(function() {
        t.end();
      });
    });
  });
});
