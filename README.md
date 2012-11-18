# grunt-contrib-usemin

A port of Yeoman usemin task for Grunt 0.4.

Let you use html comments to define list of files and run tasks.

## Getting Started
Install this grunt plugin next to your project's [Gruntfile][getting_started] with: `npm install grunt-contrib-usemin`

Then add this line to your project's Gruntfile:

```javascript
grunt.loadNpmTasks('grunt-contrib-usemin');
```

[grunt]: https://github.com/cowboy/grunt
[getting_started]: https://github.com/cowboy/grunt/blob/master/docs/getting_started.md

## Documentation

Replaces references to non-optimized scripts or stylesheets
into a set of HTML files (or any templates/views).

The users markup should be considered the primary source of information
for paths, references to assets which should be optimized.We also check
against files present in the relevant directory () (e.g checking against
the revved filename into the 'temp/') directory to find the SHA
that was generated.

### Todos:

* Use a file dictionary during build process and rev task to
store each optimized assets and their associated sha1.
* Update usemin-handler to follow @necolas proposed structure

Thx to @krzychukula for the new, super handy replace helper.

### Usemin-handler

A special task which uses the build block HTML comments in markup to
get back the list of files to handle, and initialize the grunt configuration
appropriately, and automatically.

Custom HTML "block" comments are provided as an API for interacting with the
build script. These comments adhere to the following pattern:
```
     <!-- build:<type> <path> -->
       ... HTML Markup, list of script / link tags.
     <!-- endbuild -->
```

- type: is either js or css.
- path: is the file path of the optimized file, the target output.

An example of this in completed form can be seen below:

```
    <!-- build:js js/app.js -->
      <script src="js/app.js"></script>
      <script src="js/controllers/thing-controller.js"></script>
      <script src="js/models/thing-model.js"></script>
      <script src="js/views/thing-view.js"></script>
    <!-- endbuild -->
```

Internally, the task parses your HTML markup to find each of these blocks, and
initializes for you the corresponding Grunt config for the concat / min tasks
when `type=js`, the concat / css tasks when `type=css`.

The task also handles use of RequireJS, for the scenario where you specify
the main entry point for your application using the "data-main" attribute
as follows:
```
     <!-- build:js js/app.min.js -->
     <script data-main="js/main" src="js/vendor/require.js"></script>
     <!-- -->
```
One doesn't need to specify a concat/min/css or rjs configuration anymore.

Inspired by previous work in https://gist.github.com/3024891
For related sample, see: cli/test/tasks/usemin-handler/index.html

## Contributing
In lieu of a formal styleguide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality. Lint and test your code using [grunt][grunt].

## Release History
_(Nothing yet)_

## License
Copyright (c) 2012 Sebastien Vincent  
Licensed under the MIT license.
