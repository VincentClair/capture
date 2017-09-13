var utils = require('../lib/utils');
var join = require('path').join;
var fs = require('fs');
var request = require('request');

module.exports = function (app, useCors) {
    var rasterizerService = app.settings.rasterizerService;
    var fileCleanerService = app.settings.fileCleanerService;

    // routes
    app.get('/', function (req, res, next) {
        var rawUrl = req.query.url || false;
        if (!rawUrl) {
            return res.redirect('/usage.html');
        }

        var url = utils.url(rawUrl);
        // required options
        var options = {
            uri: 'http://localhost:' + rasterizerService.getPort() + '/',
            headers: {url: url}
        };
        [
            'width',
            'height',
            'clipRect',
            'javascriptEnabled',
            'loadImages',
            'localToRemoteUrlAccessEnabled',
            'userAgent',
            'userName',
            'password',
            'delay'
        ].forEach(function (name) {
            var header = req.query[name] || false;
            if (header) {
                options.headers[name] = header;
            }
        });

        var filename = 'screenshot_' + utils.md5(url + JSON.stringify(options)) + '.png';
        options.headers.filename = filename;

        var filePath = join(rasterizerService.getPath(), filename);

        var callbackUrl = req.query.callback ? utils.url(req.query.callback) : false;

        if (fs.existsSync(filePath)) {
            console.log('Request for %s - Found in cache', url);
            processImageUsingCache(filePath, res, callbackUrl, function (err) {
                if (err) next(err);
            });
            return;
        }
        console.log('Request for %s - Rasterizing it', url);
        processImageUsingRasterizer(options, filePath, res, callbackUrl, function (err) {
            if (err) next(err);
        });
    });

    app.get('*', function (req, res) {
        // for backwards compatibility, try redirecting to the main route if the request looks like /www.google.com
        res.redirect('/?url=' + req.url.substring(1));
    });

    // bits of logic
    var processImageUsingCache = function (filePath, res, url, callback) {
        if (url) {
            // asynchronous
            res.send('Will post screenshot to ' + url + ' when processed');
            postImageToUrl(filePath, url, callback);
        } else {
            // synchronous
            sendImageInResponse(filePath, res, callback);
        }
    };

    var processImageUsingRasterizer = function (rasterizerOptions, filePath, res, url, callback) {
        if (url) {
            // asynchronous
            res.send('Will post screenshot to ' + url + ' when processed');
            callRasterizer(rasterizerOptions, function (error) {
                if (error) return callback(error);
                postImageToUrl(filePath, url, callback);
            });
        } else {
            // synchronous
            callRasterizer(rasterizerOptions, function (error) {
                if (error) return callback(error);
                sendImageInResponse(filePath, res, callback);
            });
        }
    };

    var callRasterizer = function (rasterizerOptions, callback) {
        request.get(rasterizerOptions, function (error, response, body) {
            if (error || response.statusCode !== 200) {
                console.log('Error while requesting the rasterizer: %s', error.message);
                rasterizerService.restartService();
                return callback(new Error(body));
            }
            if (body.indexOf('Error: ') === 0) {
                var errmsg = body.substring(7);
                console.log('Error while requesting the rasterizer: %s', errmsg);
                return callback(new Error(errmsg));
            }
            callback(null);
        });
    };

    var postImageToUrl = function (imagePath, url, callback) {
        console.log('Streaming image to %s', url);
        var fileStream = fs.createReadStream(imagePath);
        fileStream.on('end', function () {
            fileCleanerService.addFile(imagePath);
        });
        fileStream.on('error', function (err) {
            console.log('Error while reading file: %s', err.message);
            callback(err);
        });
        fileStream.pipe(request.post(url, function (err) {
            if (err) console.log('Error while streaming screenshot: %s', err);
            callback(err);
        }));
    };

    var sendImageInResponse = function (imagePath, res, callback) {
        console.log('Sending image in response');
        if (useCors) {
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.setHeader("Access-Control-Expose-Headers", "Content-Type");
        }
        res.sendFile(imagePath, function (err) {
            fileCleanerService.addFile(imagePath);
            callback(err);
        });
    }
};
