"use strict";

var messages     = require("./messages");
var snippetUtils = require("./snippet").utils;
var fail         = require("./utils").utils.fail;

var connect      = require("connect");
var http         = require("http");
var filePath     = require("path");
var foxy         = require("foxy");

var utils = {
    /**
     * The middleware that can emit location change events.
     * @param {Object} io
     * @param {Object} options
     * @returns {Function}
     */
    navigateCallback: function (io, options) {

        var disabled = false;
        var navigating = false;
        var canNavigate = this.canNavigate;

        return function (req, res, next) {

            if (canNavigate(req, options, io)) {

                var clients = io.sockets.clients();

                if (clients.length && !disabled && !navigating) {

                    navigating = true;
                    disabled = true;

                    io.sockets.emit("location", {
                        url: req.url
                    });

                    var timer = setTimeout(function () {

                        disabled = false;
                        navigating = false;
                        clearInterval(timer);

                    }, 300);
                }
            }
            if (typeof next === "function") {
                next();
            }
        };
    },
    /**
     * All the conditions that determine if we should emit
     * a location:change event
     * @param {Object} req
     * @param {Object} options
     * @returns {Boolean}
     */
    canNavigate: function (req, options) {

        var headers = req.headers || {};

        if (req.method !== "GET") {
            return false;
        }

        if (headers["x-requested-with"] !== undefined && headers["x-requested-with"] === "XMLHttpRequest") {
            return false;
        }

        if (!options || !options.ghostMode || !options.ghostMode.location) {
            return false;
        }

        if (snippetUtils.isExcluded(req.url, options.excludedFileTypes)) {
            return false;
        }

        return true;
    },
    /**
     * @param app
     * @param middleware
     * @returns {*}
     */
    addMiddleware: function (app, middleware) {

        if (Array.isArray(middleware)) {
            middleware.forEach(function (item) {
                app.use(item);
            });
        } else if (typeof middleware === "function") {
            app.use(middleware);
        }

        return app;
    },
    /**
     * @param app
     * @param base
     * @param index
     */
    addBaseDir: function (app, base, index) {
        if (Array.isArray(base)) {
            base.forEach(function (item) {
                app.use(connect.static(filePath.resolve(item)));
            });
        } else {
            if ("string" === typeof base) {
                app.use(connect.static(filePath.resolve(base), { index: index }));
            }
        }
    },
    /**
     * @param app
     * @param base
     */
    addDirectory: function (app, base) {
        if (Array.isArray(base)) {
            base = base[0];
        }
        app.use(connect.directory(filePath.resolve(base), {icons:true}));
    }
};
module.exports.utils = utils;

/**
 * Launch the server for serving the client JS plus static files
 * @param {String} host
 * @param {Number} port
 * @param {Object} options
 * @param {string|} scripts
 * @returns {{staticServer: (http.Server), proxyServer: (http.Server)}|Boolean}
 */
module.exports.launchServer = function (host, port, options, scripts) {

    var proxy       = options.proxy || false;
    var server      = options.server || false;
    var snippet = false;
    if (!proxy && !server) {
        snippet = true;
    }
    var scriptTags    = options.snippet    = messages.scriptTags(port, options);
    var scriptPaths   = messages.clientScript(options, true);
    var scriptPath    = options.scriptPath = scriptPaths.versioned;
    var staticServer;
    var proxyServer;
    var app;

    if (proxy) {

        proxyServer = foxy.init(
            options.proxy,
            {
                host: host,
                port: port
            },
            snippetUtils.getRegex(scriptTags),
            snippetUtils.getProxyMiddleware(scripts, scriptPath),
            function (err) {
                if (err.code === "ENOTFOUND") {
                    fail(messages.proxyError(err.code), options, true);
                }
            }
        );
    }

    if (server || snippet) {

        var baseDir, index, directory;

        if (server) {
            baseDir   = server.baseDir;
            index     = server.index || "index.html";
            directory = server.directory;
        }

        app = connect();

        if (server && server.middleware) {
            utils.addMiddleware(app, server.middleware);
        }

        app.use(function (req, res, next) {
                snippetUtils.isOldIe(req);
                return next();
            })
            .use(scriptPath, scripts)
            .use(scriptPaths.path, scripts);


        if (server) {

            if (directory) {
                utils.addDirectory(app, baseDir);
            }

            app.use(snippetUtils.getSnippetMiddleware(scriptTags));
            utils.addBaseDir(app, baseDir, index);

        }

        staticServer = http.createServer(app);
    }

    if (!staticServer && !proxyServer) {
        return false;
    } else {
        return {
            staticServer: staticServer,
            proxyServer: proxyServer
        };
    }
};
