#steer-reset

> Reset the state in google chrome

## Installation

```sheel
npm install steer-reset
```

## Dependencies

Be sure to check out the requirements for `steer`.

## Documentation

This navigates to `about:blank` and removes all cookies and alike.

```javascript
var path = require('path');
var steer = require('steer');
var reset = require('steer-reset');

var chrome = steer({
  cache: path.resolve(__dirname, 'cache'),
  inspectorPort: 7510,
  permissions: ['browsingData'] // this module needs `browsingData` permissions
});

chrome.once('open', function () {
  reset(chrome, function (err) {
    if (err) throw err;

    // chrome is now reset
  });
});
```

##License

**The software is license under "MIT"**

> Copyright (c) 2014 Peter V. T. Schlegel
>
> Permission is hereby granted, free of charge, to any person obtaining a copy
> of this software and associated documentation files (the "Software"), to deal
> in the Software without restriction, including without limitation the rights
> to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
> copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in
> all copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
> IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
> FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
> AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
> LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
> OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
> THE SOFTWARE.
