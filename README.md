# grunt2gulp

[![Flattr This](http://button.flattr.com/flattr-badge-large.png)](https://flattr.com/submit/auto?fid=y0jx3j&url=https%3A%2F%2Fgithub.com%2Fomouse%2Fgrunt2gulp.js)

![Grunt2Gulp Logo](https://github.com/omouse/grunt2gulp.js/blob/master/grunt2gulp-logo.png)

[![Codacy Badge](https://api.codacy.com/project/badge/7174ac139c9e42fabec2ebc1df48de8a)](https://www.codacy.com/app/omouse/grunt2gulp-js)

[Download it on NPM](https://www.npmjs.com/package/grunt2gulp): `npm install grunt2gulp`

Converts a Gruntfile.js to a gulp-compliant file. Why? Because if
you're going to create a new tool to replace an old one, why not
automate the process of porting configuration files over.

In the future, a standard for building JavaScript files should emerge
and be usable by whatever build tools exist. Maybe something like GNU
Make? Ah, but that's a mere fantasy...

## Installation

It's *strongly* preferable to install grunt2gulp using the Github repo
rather than from the central NPM:

    npm install https://github.com/omouse/grunt2gulp.js/archive/0.0.2-cool-card.tar.gz

## Usage

Print out a gulp file to standard output:

    grunt2gulp.js Gruntfile.js

Save the generated gulp file:

    grunt2gulp.js Gruntfile.js > gulpfile.js

## Drawbacks, Caveats

This is a very very rough tool, you will **need** to go over the
generated gulp file to ensure that it works and is correct.

To see the difference, run the `examples/simple-gruntfile.js` through
grunt2gulp and compare it to `examples/simple-gulpfile.js`. It got 90%
of the way to a complete conversion though and it took only a bit of
tweaking to get it to that state.

If there are duplicate tasks, a warning is added to the code.

# How does it work?

It loads up the Gruntfile and emulates Grunt's API. When it's done
looping through all the tasks in the grunt config, it shoves them into
definitions or tasks. Definitions are non-objects, like strings, which
need to be declared as variables when using Gulp. Tasks are converted
into Gulp tasks but some special cases have to be handled, such as
Karma and Watch.

## Hacking on grunt2gulp

The code is dirty because Grunt is very permissive in its input. You
can specify files in multiple ways: as a string, as a list of strings,
or within a files property as a string or list. If Grunt were more
modular it would be possible to just rip out the parser that Grunt
uses to turn a config into a set of tasks without also importing the
task running capability and all the other stuff.

The core functions you will want to check out are `processGruntTask`
and `processGruntConfig`.

### Using Docker for Testing

Build the image:

    docker build -t omouse/grunt2gulp.js .

Run a container with the Gruntfile to test:

    mkdir cool
    touch cool/Gruntfile.js
    docker run --rm -v $(realpath .):/data/package omouse/grunt2gulp.js

This will mount the `cool` directory to `/data/package` into the
container. The container will run the grunt2gulp command using
Gruntfile.js as input and output gulpfile.js into the `cool`
directory.

The `--rm` will delete the container after it's done running.

To use docker for testing grunt2gulp on different files you can use
`npm test`.

This requires that Docker is installed and that you have built the
image. It also requires GNU Coreutils and `realpath` command. On Mac
OS X you can use brew install coreutils.

### Adding new gruntfile examples

1. Create a new directory in the `examples/` directory
1. Create the Gruntfile.js in that new directory
1. Add a new line to `docker-test-examples.sh`

## How to Report Issues

When reporting an issue with grunt2gulp.js, please try to include the Gruntfile that you were trying to convert and the error message that you received.

You can report issues here: https://github.com/omouse/grunt2gulp.js/issues

## Documentation

You can generate the documentation using `jsdoc`:

    jsdoc node_modules/grunt2gulp/bin/grunt2gulp.js

# License

Licensed under the GPL version 3 or later.

Copyright (C) 2014-2016 Rudolf Olah <omouse@gmail.com>

See [LICENSE](./LICENSE) for full text of license.

# Known Issues With Gruntfiles

The following is a list of issues that you will have to correct
yourself before trying to convert a Gruntfile. These are issues that
are found by the linter (lintGruntFile).

Most of these issues can be fixed simply by removing or commenting out
the offending line in the Gruntfile but will typically require extra
work to be done to work as a gulpfile.

## time-grunt or grunt-timer

It is useful to know how long a task runs for. With Grunt you would use time-grunt or the grunt-timer package. In gulp, you can use the [gulp-duration](https://github.com/hughsk/gulp-duration) and/or the [time-require](https://github.com/jaguard/time-require) packages.

## grunt.loadTasks or grunt.task.loadTasks

[LoadTasks will load custom-defined tasks for Grunt](http://gruntjs.com/api/grunt.task#grunt.task.loadtasks). You will have to convert those tasks to work with gulp. The guide on [writing a plugin for gulp](https://github.com/gulpjs/gulp/blob/master/docs/writing-a-plugin/README.md) is a good starting point.
