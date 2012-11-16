var fs       = require('fs');
var path     = require('path');
var rimraf   = require('rimraf');
var mkdirp   = require('mkdirp');

// top level exports
var helpers = module.exports;

// Removes, creates and cd into the specified directory. If the current working
// directory is the same as the specified one, then acts as a noop. Meant to be
// used once per mocha suite.
//
// - dir   - the directory path to create
//
// Example:
//
//     before(helpers.directory('.test'));
//
// Returns a function suitable to use with mocha's before/after hooks.
helpers.directory = function directory(dir) {
  return function directory(done) {
    process.chdir(path.join(__dirname, '../..'));
    rimraf(dir, function(err) {
      if(err) return done(err);
      mkdirp(dir, function(err) {
        if(err) return done(err);
        process.chdir(dir);
        done();
      });
    });
  };
};

// Generates a new Gruntfile.js in the current working directory based on
// `options` hash passed in. Same as other helpers, meant to be use as a mocha handler.
//
// - options  - Grunt configuration
//
// Example
//
//    before(helpers.gruntfile({
//      foo: {
//        bar: '<config.baz>'
//      }
//    }));
//
// Returns a function suitable to use with mocha hooks.
helpers.gruntfile = function(options, taskMap) {
  return function gruntfile(done) {
    var config = 'grunt.initConfig(' + JSON.stringify(options, null, 2) + ');';
    config = config.split('\n').map(function(line) {
      return '  ' + line;
    }).join('\n');

    var tasks = Object.keys(taskMap || {}).map(function(key) {
      return '\ngrunt.registerTask(\'' + key + '\', ' + taskMap[key] + ');';
    }).join('\n');

    var out = [
      'module.exports = function(grunt) {',
      config,
      tasks,
      '};'
    ];

    fs.writeFile('Gruntfile.js', out.join('\n'), done);
  };
};


