/*
 * grunt-contrib-usemin
 * Licensed under the MIT license.
 */

var path = require('path'),
    util = require('util');

// start build pattern --> <!-- build:[target] output -->
var regbuild = /<!--\s*build:(\w+)\s*(.+)\s*-->/;

// end build pattern -- <!-- endbuild -->
var regend = /<!--\s*endbuild\s*-->/;



module.exports = function(grunt){ 
  return {

     // Output some info on given object, using util.inspect, using colorized output.
    inspect: function(o) {
      return util.inspect(o, false, 4, true);
    },

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
    getBlocks: function(body) {
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
    },



    // usemin:pre:* are used to preprocess files with the blocks and directives
    // before going through the global replace
    'usemin:pre:html': function(cwd, content) {
      var self = this;
      // XXX extension-specific for get blocks too.
      //
      // Eg. for each predefined extensions directives may vary. eg <!--
      // directive --> for html, /** directive **/ for css
      var blocks = this.getBlocks(content);

      // Determine the linefeed from the content
      var linefeed = /\r\n/g.test(content) ? '\r\n' : '\n';

      // handle blocks
      Object.keys(blocks).forEach(function(key) {
        var block = blocks[key].join(linefeed),
          parts = key.split(':'),
          type = parts[0],
          target = parts[1];

        content = self.usemin(cwd, content, block, target, type);
      });

      return content;
    },

    // usemin and usemin:* are used with the blocks parsed from directives
    usemin: function(cwd, content, block, target, type) {
      target = target || 'replace';
      return this['usemin:' + type](cwd, content, block, target);
    },

    'usemin:css': function(cwd, content, block, target) {
      var linefeed = /\r\n/g.test(content) ? '\r\n' : '\n';
      var indent = (block.split(linefeed)[0].match(/^\s*/) || [])[0];
      return content.replace(block, indent + '<link rel="stylesheet" href="' + target + '"\/>');
    },

    'usemin:js': function(cwd, content, block, target) {
      var linefeed = /\r\n/g.test(content) ? '\r\n' : '\n';
      var indent = (block.split(linefeed)[0].match(/^\s*/) || [])[0];
      return content.replace(block, indent + '<script src="' + target + '"></script>');
    },

    'usemin:post:css': function(cwd, content) {
      grunt.log.writeln('Update the CSS with new img filenames');
      content = this.replace(cwd, content, /url\(\s*['"]([^"']+)["']\s*\)/gm);
      
      grunt.log.verbose.writeln('Update the CSS with background imgs, case there is some inline style');
      content = this.replace(cwd, content, /url\(\s*['"]?([^'"\)]+)['"]?\s*\)/gm);
      
      return content;
    },

    // usemin:post:* are the global replace handlers, they delegate the regexp
    // replace to the replace helper.
    'usemin:post:html': function(cwd, content) {
      grunt.log.verbose.writeln('Update the HTML to reference our concat/min/revved script files');
      content = this.replace(cwd, content, /<script.+src=['"](.+)["'][\/>]?><[\\]?\/script>/gm);

      grunt.log.verbose.writeln('Update the HTML with the new css filenames');
      content = this.replace(cwd, content, /<link[^\>]+href=['"]([^"']+)["']/gm);

      grunt.log.verbose.writeln('Update the HTML with the new img filenames');
      content = this.replace(cwd, content, /<img[^\>]+src=['"]([^"']+)["']/gm);

      grunt.log.verbose.writeln('Update the HTML with background imgs, case there is some inline style');
      content = this.replace(cwd, content, /url\(\s*['"]([^"']+)["']\s*\)/gm);

      grunt.log.verbose.writeln('Update the HTML with anchors images');
      content = this.replace(cwd, content, /<a[^\>]+href=['"]([^"']+)["']/gm);

      return content;
    },

    //
    // global replace handler, takes a file content a regexp to macth with. The
    // regexp should capture the assets relative filepath, it is then compared to
    // the list of files on the filesystem to guess the actual revision of a file
    //
    'replace': function(cwd, content, regexp) {
      
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
        var minSrc = path.join( cwd , dirname , basename + ".min" + extname ); 
        var revSrc = path.join( cwd, dirname , '*.' + basename + extname );
        var revMinSrc = path.join( cwd , dirname , '*.' + basename + ".min" + extname ); 

        // XXX files won't change, the filepath should filter the original list
        // of cached files (we need to treat the filename collision -- i.e. 2 files with same names
        // in different subdirectories)
        var filepaths = grunt.file.expand([minSrc,revSrc,revMinSrc]);
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
    }
  };
};
