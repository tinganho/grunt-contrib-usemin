/*
 * grunt-contrib-usemin
 * Licensed under the MIT license.
 */

var fs = require('fs'),
  path = require('path'),
  util = require('util');

// start build pattern --> <!-- build:[target] output -->
var regbuild = /<!--\s*build:(\w+)\s*(.+)\s*-->/;

// end build pattern -- <!-- endbuild -->
var regend = /<!--\s*endbuild\s*-->/;


//
// Returns an hash object of all the directives for the given html. Results is
// of the following form:
//
//     {
//        'css/site.css ':[
//          '  <!-- build:css css/site.css -->',
//          '  <link rel="stylesheet" href="css/style.css">',
//          '  <!-- endbuild -->'
//        ],
//        'js/head.js ': [
//          '  <!-- build:js js/head.js -->',
//          '  <script src="js/libs/modernizr-2.5.3.min.js"></script>',
//          '  <!-- endbuild -->'
//        ],
//        'js/site.js ': [
//          '  <!-- build:js js/site.js -->',
//          '  <script src="js/plugins.js"></script>',
//          '  <script src="js/script.js"></script>',
//          '  <!-- endbuild -->'
//        ]
//     }
//
function getBlocks(body) {
  var lines = body.replace(/\r\n/g, '\n').split(/\n/),
    block = false,
    sections = {},
    last;

  lines.forEach(function(l) {
    var build = l.match(regbuild),
      endbuild = regend.test(l);

    if(build) {
      block = true;
      sections[[build[1], build[2].trim()].join(':')] = last = [];
    }

    // switch back block flag when endbuild
    if(block && endbuild) {
      last.push(l);
      block = false;
    }

    if(block && last) {
      last.push(l);
    }
  });

// Todo: Change to match @necolas suggested structure for the usemin blocks.
// {
//   type: 'css',
//   dest: 'css/site.css',
//   src: [
//     'css/normalize.css',
//     'css/main.css'
//   ],
//   raw: [
//     '    <!-- build:css css/site.css -->',
//     '    <link rel="stylesheet" href="css/normalize.css">',
//     '    <link rel="stylesheet" href="css/main.css">',
//     '    <!-- endbuild -->'
//   ]
// }

  return sections;
}

function inspect(obj) {
  return util.inspect(obj, false, 4, true);
}


module.exports = function(grunt) {

  grunt.registerMultiTask('usemin', 'Replaces references to non-minified scripts / stylesheets', function() {
    
    var baseDir = this.options().baseDir;

    var name = this.target;
    if ((typeof this.data) === 'string') {this.data = [this.data];}
    var files = grunt.file.expand(this.data.map(function(f) { 
        return path.join(baseDir, f);
      }));

    files.map(grunt.file.read).forEach(function(content, i) {
      var p = files[i];

      grunt.log.subhead('usemin:' + name + ' - ' + p);

      // make sure to convert back into utf8, `file.read` when used as a
      // forEach handler will take additional arguments, and thus trigger the
      // raw buffer read
      content = content.toString();

      // ext-specific directives handling and replacement of blocks
      if(!!grunt.task._helpers['usemin:pre:' + name]) {
        content = grunt.helper('usemin:pre:' + name, content);
      }

      // actual replacement of revved assets
      if(!!grunt.task._helpers['usemin:post:' + name]) {
        content = grunt.helper('usemin:post:' + name, content);
      }

      // write the new content to disk
      grunt.file.write(p, content);
    });

  });

  grunt.registerMultiTask('usemin-handler', 'Using HTML markup as the primary source of information', function() {
    var baseDir = this.options().baseDir;
    // collect files
    if ((typeof this.data) === 'string') {this.data = [this.data];}
    var files = grunt.file.expandFiles(this.data.map(function(f) {
      return path.join(baseDir, f);
    }));
    // concat / min / css / rjs config
    var concat = grunt.config('concat') || {},
      min = grunt.config('min') || {},
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
      var blocks = getBlocks(file.body);
      Object.keys(blocks).forEach(function(dest) {
        var lines = blocks[dest].slice(1, -1),
          parts = dest.split(':'),
          type = parts[0],
          output = parts[1];
        // Handle absolute path (i.e. with respect to th eserver root)
        if (output[0] === '/') {
          output = output.substr(1);
        }
        output = path.join(baseDir , output);

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
          b = ( b ? b.split(',') : '');
          return a.concat(b);
        }, []);

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

        // min config, only for js type block
        if(type === 'js') {
          min[output.replace(".js",".min.js")] = output;
          grunt.config('min', min);
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
      .writeln('  ' + inspect(grunt.config('concat')))
      .subhead('  mincss:')
      .writeln('  ' + inspect(grunt.config('mincss')))
      .subhead('  min:')
      .writeln('  ' + inspect(grunt.config('min')))
      .subhead('  rjs:')
      .writeln('  ' + inspect(grunt.config('rjs')));
  });

   // Output some info on given object, using util.inspect, using colorized output.
  grunt.registerHelper('inspect', function(o) {
    return util.inspect(o, false, 4, true);
  });

  // Helpers
  // -------

  // usemin:pre:* are used to preprocess files with the blocks and directives
  // before going through the global replace
  grunt.registerHelper('usemin:pre:html', function(content) {
    // XXX extension-specific for get blocks too.
    //
    // Eg. for each predefined extensions directives may vary. eg <!--
    // directive --> for html, /** directive **/ for css
    var blocks = getBlocks(content);

    // Determine the linefeed from the content
    var linefeed = /\r\n/g.test(content) ? '\r\n' : '\n';

    // handle blocks
    Object.keys(blocks).forEach(function(key) {
      var block = blocks[key].join(linefeed),
        parts = key.split(':'),
        type = parts[0],
        target = parts[1];

      content = grunt.helper('usemin', content, block, target, type);
    });

    return content;
  });

  // usemin and usemin:* are used with the blocks parsed from directives
  grunt.registerHelper('usemin', function(content, block, target, type) {
    target = target || 'replace';
    return grunt.helper('usemin:' + type, content, block, target);
  });

  grunt.registerHelper('usemin:css', function(content, block, target) {
    var linefeed = /\r\n/g.test(content) ? '\r\n' : '\n';
    var indent = (block.split(linefeed)[0].match(/^\s*/) || [])[0];
    return content.replace(block, indent + '<link rel="stylesheet" href="' + target + '"\/>');
  });

  grunt.registerHelper('usemin:js', function(content, block, target) {
    var linefeed = /\r\n/g.test(content) ? '\r\n' : '\n';
    var indent = (block.split(linefeed)[0].match(/^\s*/) || [])[0];
    return content.replace(block, indent + '<script src="' + target + '"></script>');
  });

  grunt.registerHelper('usemin:post:css', function(content) {
    grunt.log.writeln('Update the CSS with new img filenames');
    content = grunt.helper('replace', content, /url\(\s*['"]([^"']+)["']\s*\)/gm);
    return content;
  });

  // usemin:post:* are the global replace handlers, they delegate the regexp
  // replace to the replace helper.
  grunt.registerHelper('usemin:post:html', function(content) {
    grunt.log.verbose.writeln('Update the HTML to reference our concat/min/revved script files');
    content = grunt.helper('replace', content, /<script.+src=['"](.+)["'][\/>]?><[\\]?\/script>/gm);

    grunt.log.verbose.writeln('Update the HTML with the new css filenames');
    content = grunt.helper('replace', content, /<link[^\>]+href=['"]([^"']+)["']/gm);

    grunt.log.verbose.writeln('Update the HTML with the new img filenames');
    content = grunt.helper('replace', content, /<img[^\>]+src=['"]([^"']+)["']/gm);

    grunt.log.verbose.writeln('Update the HTML with background imgs, case there is some inline style');
    content = grunt.helper('replace', content, /url\(\s*['"]([^"']+)["']\s*\)/gm);

    grunt.log.verbose.writeln('Update the HTML with anchors images');
    content = grunt.helper('replace', content, /<a[^\>]+href=['"]([^"']+)["']/gm);

    return content;
  });

  grunt.registerHelper('usemin:post:css', function(content) {

    grunt.log.verbose.writeln('Update the CSS with background imgs, case there is some inline style');
    content = grunt.helper('replace', content, /url\(\s*['"]?([^'"\)]+)['"]?\s*\)/gm);

    return content;
  });

  //
  // global replace handler, takes a file content a regexp to macth with. The
  // regexp should capture the assets relative filepath, it is then compared to
  // the list of files on the filesystem to guess the actual revision of a file
  //
  grunt.registerHelper('replace', function(content, regexp) {
    var baseDir = grunt.task.current.options().baseDir;
    return content.replace(regexp, function(match, src) {
      //do not touch external files or the root
      if ( src.match(/\/\//) || src.match(/^\/$/)) {
        return match;
      }

      // Consider reference from site root
      if ( src.match(/^\//) ) {
        src = src.substr(1);
      }

      var dirname = path.dirname(src);
      var extname = path.extname(src);
      var basename = path.basename(src, extname);
      //'*'.path.
      var revSrc = path.join( baseDir, dirname , '*.' + basename + extname );
      var revMinSrc = path.join( baseDir , dirname , '*.' + basename + ".min" + extname ); 

      // XXX files won't change, the filepath should filter the original list
      // of cached files (we need to treat the filename collision -- i.e. 2 files with same names
      // in different subdirectories)
      var filepaths = grunt.file.expand([revSrc,revMinSrc]);
      var filepath = filepaths[0];

      // not a file in temp, skip it
      if ( !filepath ) {
        return match;
      }
      var filename = path.basename(filepath);
      // handle the relative prefix (with always unix like path even on win32)
      filename = [dirname, filename].join('/');
      // if file not exists probaly was concatenated into another file so skip it
      if ( !filename ) {
        return '';
      }

      var res = match.replace(src, filename);
      // output some verbose info on what get replaced
      grunt.log
        .ok(src)
        .writeln('was ' + match)
        .writeln('now ' + res);
      return res;
    });
  });
};

