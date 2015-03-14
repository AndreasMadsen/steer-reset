
// This plugin will reset the browser state
module.exports = function reset(browser, callback) {

  browser.inspector.Page.navigate('about:blank', function(err) {
    if (err) return callback(err);

    browser.extension.send('chrome.browsingData.remove', {}, {
      'cookies': true,
      'fileSystems': true,
      'indexedDB': true,
      'webSQL': true
      // TODO: reactivate this, when the weird bug is found
      // See: https://github.com/AndreasMadsen/chrome-bug
    }, callback);
  });
};
