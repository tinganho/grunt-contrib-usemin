/*
 * grunt-contrib-usemin
 * Licensed under the MIT license.
 */

var path = require('path');

module.exports = function(grunt) {

  var helpers = require('../lib/usemin-helpers')(grunt);

  grunt.registerMultiTask('usemin', 'Replaces references to non-minified scripts / stylesheets', function() {
    
    var basePath = this.options().basePath;
    var name = this.target;
    if ((typeof this.data) === 'string') {this.data = [this.data];}
    var files = grunt.file.expand(this.data.map(function(f) { 
        return path.join(basePath, f);
      }));

    files.map(grunt.file.read).forEach(function(content, i) {
      var p = files[i];
      var cwd = path.dirname(p);
      
      grunt.log.subhead('usemin:' + name + ' - ' + p);

      // make sure to convert back into utf8, `file.read` when used as a
      // forEach handler will take additional arguments, and thus trigger the
      // raw buffer read
      content = content.toString();

      // ext-specific directives handling and replacement of blocks
      if(!!helpers['usemin:pre:' + name]) {
        content = helpers['usemin:pre:' + name](cwd, content);
      }

      // actual replacement of revved assets
      if(!!helpers['usemin:post:' + name]) {
        content = helpers['usemin:post:' + name](cwd, content);
      }

      // write the new content to disk
      grunt.file.write(p, content);
    });

  });

  grunt.registerMultiTask('usemin-handler', 'Using HTML markup as the primary source of information', function() {
    var basePath = this.options().basePath;
    // collect files
    if ((typeof this.data) === 'string') {this.data = [this.data];}
    var files = grunt.file.expandFiles(this.data.map(function(f) {
      return path.join(basePath, f);
    }));
    // concat / uglify / css / rjs config
    var concat = grunt.config('concat') || {},
      uglify = grunt.config('uglify') || {},
      mincss = grunt.config('mincss') || {},
      rjs = grunt.config('rjs') || {};

    grunt.log
      .writeln('Going through ' + grunt.log.wordlist(files) + ' to update the config')
      .writeln('looking for build script HTML comment blocks');

    files = files.map(function(filepath) {
      return {
        path: filepath,
        body: grunt.file.read(filepath)
      };
    });

    files.forEach(function(file) {
      var blocks = helpers.getBlocks(file.body);
      Object.keys(blocks).forEach(function(dest) {
        var lines = blocks[dest].slice(1, -1),
          parts = dest.split(':'),
          type = parts[0],
          output = parts[1];
        // Handle absolute path (i.e. with respect to th eserver root)
        if (output[0] === '/') {
          output = output.substr(1);
        }
        output = path.join(basePath , output);
        // parse out the list of assets to handle, and update the grunt config accordingly
        var assets = lines.map(function(tag) {
          var asset = (tag.match(/(href|src)=["']([^'"]+)["']/) || [])[2];

          // RequireJS uses a data-main attribute on the script tag to tell it
          // to load up the main entry point of the amp app
          //
          // First time we findd one, we update the name / mainConfigFile
          // values. If a name of mainConfigFile value are already set, we skip
          // it, so only one match should happen and default config name in
          // original Gruntfile is used if any.
          var main = tag.match(/data-main=['"]([^'"]+)['"]/);
          if(main) {
            rjs.out = rjs.out || output;
            rjs.name = rjs.name || main[1];
            asset += ',' + output;
          }
          return asset;
        }).reduce(function(a, b) {
          if(b)
            { return a.concat(b.split(',')); }
          else 
            {return a;}
        }, []);
        assets = assets.map(function(asset) {
          return path.join(basePath, asset);
        }); 
        grunt.log.subhead('Found a block:')
          .writeln(grunt.log.wordlist(lines, { separator: '\n' }))
          .writeln('Updating config with the following assets:')
          .writeln('    - ' + grunt.log.wordlist(assets, { separator: '\n    - ' }));

        // update concat config for this block
        concat[output] = assets;
        grunt.config('concat', concat);

        // update rjs config as well, as during path lookup we might have
        // updated it on data-main attribute
        grunt.config('rjs', rjs);

        // uglify config, only for js type block
        if(type === 'js') {
          uglify[output.replace(".js",".min.js")] = output;
          grunt.config('uglify', uglify);
        }

        // mincss config, only for mincss type block
        if(type === 'css') {
          mincss[output.replace('.css','.min.css')] = output;
          grunt.config('mincss', mincss);
        }
      });
    });

    // log a bit what was added to config
    grunt.log.subhead('Configuration is now:')
      .subhead('  concat:')
      .writeln('  ' + helpers.inspect(grunt.config('concat')))
      .subhead('  mincss:')
      .writeln('  ' + helpers.inspect(grunt.config('mincss')))
      .subhead('  uglify:')
      .writeln('  ' + helpers.inspect(grunt.config('uglify')))
      .subhead('  rjs:')
      .writeln('  ' + helpers.inspect(grunt.config('rjs')));
  });

};

