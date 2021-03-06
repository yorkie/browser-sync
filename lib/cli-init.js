"use strict";

var defaultConfig = require("./default-config");
var cliOptions    = require("./cli-options");
var info          = require("./cli-info");

var program       = require("commander");
var merge         = require("opt-merger").merge;

module.exports.allowedOptions = ["host", "server", "proxy"];

/**
 * Handle command-line usage with 'start'
 * @param args
 * @param cb
 */
module.exports.startFromCommandLine = function (args, cb) {

    var userConfig;

    // First look for provided --config option
    if (args.config) {
        userConfig = info._getConfigFile(args.config);
    }

    var options = merge(defaultConfig, userConfig || {}, cliOptions.callbacks);

    cb(null, {
        files: options.files || [],
        config: options
    });
};

/**
 * @param {String} version
 * @param {Object} args - optimist object
 * @param {Object} argv
 * @param {Function} cb
 */
module.exports.parse = function (version, args, argv, cb) {

    program
        .version(version)
        .usage("<command> [options]")
        .option("--files",     "File paths to watch")
        .option("--exclude",   "File patterns to ignore")
        .option("--server",    "Run a Local server (uses your cwd as the web root)")
        .option("--directory", "Show a directory listing for the server")
        .option("--proxy",     "Proxy an existing server")
        .option("--xip",       "Use xip.io domain routing")
        .option("--tunnel",    "Use a public URL")
        .option("--config",    "Specify a path to a bs-config.js file")
        .option("--host",      "Specify a hostname to use")
        .option("--logLevel",  "Set the logger output level (silent, info or debug)")
        .option("--port",      "Specify a port to use")
        .option("--no-open",   "Don't open a new browser window")
        .option("--no-ghost",  "Disable Ghost Mode")
        .option("--no-online", "Force offline usage");

    program
        .on("--help", function(){
            console.log("  Server Example:");
            console.log("  ---------------");
            console.log("    Use current directory as root & watch CSS files");
            console.log("");
            console.log("    $ browser-sync start --server --files=\"css/*.css\"");
            console.log("");
            console.log("  Proxy Example:");
            console.log("  --------------");
            console.log("    Proxy `localhost:8080` & watch CSS files");
            console.log("");
            console.log("    $ browser-sync start --proxy=\"localhost:8080\" --files=\"css/*.css\"");
            console.log("");
        });

    program
        .command("init")
        .description("Creates a default config file")
        .action(function() {
            cb(null, {configFile: true});
        });

    program
        .command("start")
        .description("Start Browser Sync")
        .action(exports.startFromCommandLine.bind(null, args, cb));

    program.parse(argv);

    if (!args._.length) {
        program.help();
    }
};

