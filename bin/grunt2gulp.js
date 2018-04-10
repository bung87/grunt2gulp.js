#!/usr/bin/env node
/**
 * @module grunt2gulp
 */

'use strict';

var fs = require('fs');
var path = require('path');
var grunt = require('grunt');
const { execSync } = require('child_process');
const is = require('is_js');

/**
 * Whether or not debug mode is on
 * @member {boolean} DEBUG
 */
var DEBUG = true;

/**
 * Whether or not to be extra verbose in logging messages
 * @member {boolean} VERBOSE
 */
var VERBOSE = false;

/**
 * Displays how to use the tool
 * @function usage
 */
function usage() {
  console.log('grunt2gulp: converts Gruntfile.js to Gulp file, prints to stdout');
  console.log('Usage: ' + process.argv[0] + ' <gruntfiles...>');
}

// Output functions
/**
 * Displays a message if the debug flag is on
 * @function debug
 * @param {String} str The message to print
 * @see [DEBUG]{@link module:grunt2gulp~DEBUG}
 */
function debug(str) {
  if (DEBUG) {
    console.error.apply(null,["DEBUG:"].concat(Array.prototype.slice.apply(arguments)))
  }
}

/**
 * Displays a message if the verbose flag is on
 * @function verbose
 * @param {String} str The message to print
 * @see [VERBOSE]{@link module:grunt2gulp~DEBUG}
 */
function verbose(str) {
  if (VERBOSE) {
    console.log("/*", str, "*/");
  }
}

/**
 * Displays a message, if the parameter is undefined displays an empty
 * string.
 * @function out
 * @param {String} str The message to print
 */
function out(str) {
  console.log(str === undefined ? '' : str);
}

/**
 * Emulates the interface of `grunt`
 * @class gruntConverter
 * @classdesc Class for converting grunt files to gulp
 */
function gruntConverter(gruntModule) {
  var gruntRequired = false;

  function printExtroCode(){
    let lines = gruntModule.toString().split('\n');
    let end = lines.findIndex( line => {
      return /grunt\.initConfig\(/g.test(line)
    } )
    let gruntNeed =  lines.find( line =>{
      return /grunt\./g.test(line)
    });
    if (gruntNeed){
      out("var grunt = require('grunt');");
      gruntRequired = true;
    }
    out(lines.slice(1,end).join('\n'))
  }
  
  /**
   * The list of Grunt tasks
   * @inner
   * @default
   */
  var tasks = [];

  /**
   * The list of Grunt task names
   * @inner
   * @default
   */
  var taskNames = [];

  /**
   * The list of Gulp variable definitions
   * @inner
   * @default
   */
  var definitions = [];

  /**
   * The list of module names for Gulp to load via require
   * @inner
   * @default
   */
  var requires = ['rename'];

  /**
   * The list of modules that Gulp does not need to load
   * @inner
   * @default
   */
  var gulpExcludedPackages = ['grunt-contrib-watch','grunt-bowercopy'];

  // output functions
  function src(srcs,option){
    if(is.array(srcs)){
      out(`    .src( ${JSON.stringify( srcs )} ${option ? ","+JSON.stringify(option):""})`);
    }else{
      out(`    .src('${srcs}'${option ? ","+JSON.stringify(option):""})`);
    }
    
  }
  /**
   * Prints out the pipe command for a Gulp file
   * @param {String} str The argument to the pipe command.
   * @inner
   */
  function pipe(str) {
    out("    .pipe(" + str + ")");
  }

  /**
   * Prints out the gulp.dest command for a Gulp file
   * @param {String} str The argument to the gulp.dest command.
   * @inner
   */
  function dest(str,option) {
    let destDir = path.extname(str) ? path.dirname(str) : str;
    pipe(`gulp.dest('${destDir}'${option ? ","+JSON.stringify(option):""})`);
  }

  // task-specific printers

  /**
   * An object containing task-specific printers. For example, the
   * jshint task in Grunt needs to be output in a certain way for the
   * Gulp file.
   * @inner
   * @default new Object
   */
  var taskPrinters = Object.create(null);

  function getTaskOption(task){
    let option = is.empty(task.options ) ? "" : JSON.stringify(task.options)
    return option;
  }

  taskPrinters['jshint'] = function jshint() {
    pipe("jshint()");
    pipe("jshint.reporter('default')");
  }

  taskPrinters['uglify'] = function uglify(task,afterProduced) {
    let option = getTaskOption(task);
    src(task.src)
    pipe(`uglify(${option})`);
    afterProduced && afterProduced()
    dest(task.dest)
    // pipe("rename({suffix: '.min'})")
  }

  taskPrinters['concat'] = function concat(task,afterProduced) {
    let option = getTaskOption(task);
    src(task.src)
    // pipe("concat('all.js')");
    pipe(`concat('${path.basename(task.dest)}',${option})`);
    afterProduced && afterProduced()
    dest(task.dest)
  }

  taskPrinters['replace'] = function replace(task,afterProduced) {
    src(task.src)
    task.options.patterns.forEach( p => {
      let pattern = p.match,replacement = p.replacement
      pipe(`replace(${pattern},${replacement})`);
    })
    afterProduced && afterProduced()
    dest(task.dest)
  }
  
  taskPrinters['wiredep'] = function wiredep(task,afterProduced) {
    src(task.src)
    pipe('wiredep()');
    afterProduced && afterProduced()
    dest(task.dest)
  }
  
  taskPrinters['filerev'] = function filerev(task,afterProduced) {
    // TODO: #15 custom filerev taskPrinter
  }

  taskPrinters['less'] = function (task,afterProduced) {
    let option = getTaskOption(task);
    src(task.src)
    pipe(`less(${option})`);
    afterProduced && afterProduced()
    dest(task.dest)
  }

  taskPrinters['cssmin'] = function (task,afterProduced) {
    let option = getTaskOption(task);
    src(task.src)
    pipe(`cssmin(${option})`);
    pipe("rename({suffix: '.min'})")
    afterProduced && afterProduced()
    dest(task.dest)
  }
  function prefixInBowerrc(){
    return JSON.parse(fs.readFileSync(path.resolve(".bowerrc"), 'utf-8')).hasOwnProperty("directory")
  }

  taskPrinters['bowercopy'] = function (task,afterProduced) {
    var srcPrefix ;
    if( "options" in task && 'srcPrefix' in task.options ){
      srcPrefix = task.options.srcPrefix 
    }else if(fs.existsSync(path.resolve(".bowerrc"))){
      let config = JSON.parse(fs.readFileSync(path.resolve(".bowerrc"), 'utf-8'))
      
      if(config.hasOwnProperty("directory")){
        srcPrefix = config["directory"]
      }else{
        srcPrefix = "bower_components"
      }
    }else{
      srcPrefix = "bower_components"
    }
    src(task.src,{cwd:srcPrefix,allowEmpty:true})
    afterProduced && afterProduced()
    dest(task.dest,{
      cwd:task.options.destPrefix
    })
  }

   

  /**
   * Processing grunt tasks into gulp tasks and adds them to [taskNames]{@link module:grunt2gulp~gruntConverter~taskNames}. Detects any potential duplicate tasks.
   *
   * @param {String} taskName The name of the gulp task.
   * @param {Object.<String, Object>} src Dictionary of source files, the key is the filename, the value is the module.
   * @param {String} dest The destination file. When this is set to 'files', the destination is not set for the added gulp task.
   * @inner
   */
  function processGruntTask(taskName, src, dest, options, taskTasks ) {
      let gulpTask = Object.create(null);
      gulpTask.name = taskName;
      gulpTask.src = src;
      if (dest !== 'files') {
        gulpTask.dest = is.array(dest) && dest.length === 1 ? dest[0] : dest;
      }

      // check for duplicate gulp task names
      if (taskNames.indexOf(gulpTask.name) !== -1) {
        gulpTask._isDuplicate = true;
      } else {
        taskNames.push(gulpTask.name);
      }
      gulpTask.options = options;
      gulpTask.tasks = taskTasks;
      tasks.push(gulpTask);
  }

  function processFileList(fileList) {
    let src = [], dest = [];
    fileList.forEach(v => {
      if (is.object(v)) {
        src = src.concat(v.src);
        dest.push(v.dest);
      } else {
        src = src.concat(v);
        dest.push(v);
      }
    })
    return [src, dest]
  }

  /**
   * Processes the grunt configuration for a task with options.
   *
   * @param {String} taskName The name of the grunt task
   * @param {(Object|String)} options The configuration options for
   * the grunt task. When passed as an object, can handle the src and
   * dest configuration options. When passed as a string, assumes that
   * it is a destination path.
   * @see [processGruntTask]{@link module:grunt2gulp~gruntConverter~processGruntTask}
   * @inner
   */
  function processGruntConfig(taskName, options,config) {
  
    if (is.object(options)) {
      for (let option in options) {
        let src = [], dest = [];

        if (option === 'options' || taskName == 'pkg') {
          continue;
        } else {

          if (typeof(options[option]) === 'string') {
            // @todo handle this case
            out('// TODO: ' + option + ', ' + options[option]);
          } else if ('src' in options[option]) {
            if (typeof options[option].src === 'string') {
              src.push(options[option].src);
            } else {
              src = src.concat(options[option].src);
            }
            dest.push(options[option].dest);
          } else if ('files' in options[option]) {
            if (typeof options[option].files === 'string') {
              src.push(options[option].files);
            } else if (is.array(options[option].files)){
              let [src1,dest1] = processFileList(options[option].files);
              src = src.concat(src1)
              dest = dest.concat(dest1)
            } else if(is.object(options[option].files)){
              for (let key in options[option].files) {
                 let fileList = options[option].files[key];
                if (is.array(fileList)){
                  let fileList = options[option].files[key];
                  for (let i = 0; i < fileList.length; i += 1) {
                    src.push(fileList[i]);
                    dest.push(fileList[i]);
                  }
                } else {
                  src.push(fileList);
                  dest.push(key);
                }
              }
            }
          } else {
            // option is the destination path
            // options[option] is the list of source files
            src = src.concat(options[option].src);
            dest.push(option);
          }
          let
            taskOptions = 'options' in options[option] && is.object(options[option]['options']) ? options[option]['options'] : {},
            taskTasks = 'tasks' in options[option] && is.array(options[option]['tasks']) ? options[option]['tasks'] : [];
          processGruntTask(taskName + ":" + option, src.filter(x => !is.undefined(x)).map(x => {
            return grunt.template.process(x, { data: config })
          }), dest, taskOptions, taskTasks);
        }
      }
    } else if (typeof options === 'string') {
      // the task name is a variable definition
      definitions.push({ name: taskName, value: "'" + options + "'" });
    }
  }

  /**
   * Prints out the gulp versions of the grunt tasks
   *
   * @param {Object} definition The task
   * @param {String} definition.name The name of a gulp task
   * @param {String} definition.value The value of the gulp task, typically a pipe.
   * @see [out]{@link module:grunt2gulp~out}
   * @inner
   */
  function printDefinition(definition) {

    var value = typeof definition.value === "string" ? definition.value.replace(/\n/g,"\\n") : definition.value;
    out("var " + definition.name + " = " + value + ";");
  }

  /**
   * Prints out a require statement for a gulp module. Prefixes the
   * module name with 'gulp'.
   *
   * @param {String} moduleName The name of the module to require/load
   * @see [out]{@link module:grunt2gulp~out}
   * @inner
   */
  function printRequire(moduleName) {
    var name = moduleName;
    if (moduleName !== 'gulp') {
        name = 'gulp-' + moduleName;
    }
    try{
      execSync('npm info ' + name,{
        stdio: 'ignore'
      });
      
      out("var " + camelCase(moduleName) + " = require('" + name + "');");
      return [true,name]
    }catch(e){
      debug(`'${name}' is not in the npm registry,will using grunt.loadNpmTasks('grunt-${moduleName}')`);
      if(!gruntRequired)
      out("var grunt = require('grunt');");
      gruntRequired = true;
      out("grunt.loadNpmTasks('grunt-" + moduleName + "');");
    }
    return false
  }

  /**
   * Given a string with hyphens (-), return a camel cased string
   * e.g. quick-brown-fox returns quickBrownFox
   *
   * @param {String} input the string to camel case
   * @inner
   */
  function camelCase(input) {
    return input.toLowerCase().replace(/-(.)/g, function(match, group1) {
      return group1.toUpperCase();
    });
  }
  /**
   * Prints out the gulp task definition.
   *
   * @param {Object} task The gulp task
   * @param {boolean} task._isDuplicate Whether or not the task is a potential duplicate
   * @see [out]{@link module:grunt2gulp~out}
   * @inner
   */
  function printTask(task) {
    var duplicate = '',taskCallBack='';
    if ('_isDuplicate' in task && task._isDuplicate) {
      duplicate = ' // WARNING: potential duplicate task';
    }
    if ('body' in task){
      taskCallBack = `,${task.body}`
    }
    if ('dependencies' in task) {
      out(`gulp.task('${task.name}', gulp.series(${JSON.stringify(task.dependencies)})${taskCallBack});`);
    } else {
      if ('body' in task){
        out(`gulp.task('${task.name}'${taskCallBack}`);
        return;
      }
      out("gulp.task('" + task.name + "', function () {" + duplicate);

      if ('dest' in task && is.array(task.dest)) {
        out("  return merge(");
        //task no needs rename
        let taskDestBaseNameSameAsSrc = task.dest.filter((x, index) => {
          return path.basename(x) == path.basename(task.src[index])
        })
        let pairsGroups = {}
        taskDestBaseNameSameAsSrc.forEach((x, index, dests) => {
          let destDir = path.extname(x) ? path.dirname(x) : x;
          if (!pairsGroups.hasOwnProperty(destDir)) {
            pairsGroups[destDir] = []
          }
          let originIndex = task.dest.indexOf(x);
          pairsGroups[destDir].push(task.src[originIndex])
        })

        for (let k in pairsGroups) {
          let
            pluginName = task.name.split(":")[0];

          if (pluginName in taskPrinters) {
            let newTask = Object.assign({}, task, { src: pairsGroups[k], dest: k })
            verbose('Found task in taskPrinters: ' + task.name);
            out("    gulp")
            taskPrinters[pluginName](newTask);
          } else {
            out("    gulp")
            src(pairsGroups[k])
            dest(k)
          }
          out("    ,");

        }
        //src and dest pairs
        let taskRests = task.dest.filter(x => { return -1 == taskDestBaseNameSameAsSrc.indexOf(x) });

        taskRests.forEach(function (x, index, dests) {

          let
            pluginName = task.name.split(":")[0];

          if (pluginName in taskPrinters) {
            let
              originIndex = task.dest.indexOf(x),
              newTask = Object.assign({}, task, { src: task.src[originIndex], dest: x });

            verbose('Found task in taskPrinters: ' + task.name);
            out("    gulp")

            function afterProduced(x, index, task) {
              let ext = path.extname(x);
              if (ext && path.basename(x) != path.basename(task.src[index])) {
                pipe("rename('" + path.basename(x) + "')")
              }
            }
            taskPrinters[pluginName](newTask, afterProduced.bind(null, x, originIndex, task));
          } else {
            out("    gulp")
            src(task.src[index])
            dest(x)
          }

          if (index < dests.length - 1) {
            out("    ,");
          }
        });

        out("  );");
      } else if ('dest' in task && task.dest !== undefined) {
        out("  return gulp");

        let pluginName = task.name.split(":")[0]
        if (pluginName in taskPrinters) {
          verbose('Found task in taskPrinters: ' + task.name);
          taskPrinters[pluginName](task);

        } else {
          if ('src' in task) {
            src(task.src)
          }

          if ('dest' in task && task.dest !== undefined) {
            verbose('Printing task destination: ' + task.name);
            dest(task.dest)
          } else {
            verbose('Task not found in taskPrinters or destination file is ' +
              'undefined: ' + task.name + ', ' + task.dest);
          }
        }
      } else {
        out("  return gulp");
        src(task.src)
        verbose('Task not found in taskPrinters or destination file is ' +
          'undefined: ' + task.name + ', ' + task.dest);
      }
      out("});");
    }
  }

  /**
   * Prints out a gulp task for watching files. Similar to grunt watch.
   *
   * @param {Object} task The gulp task
   * @param {String} task.name The name of the gulp task
   * @param {String} task.src The source file of the task
   * @inner
   */
  function printWatchTask(task) {
    out("gulp.task('" + task.name + "', function () {");
    out("  gulp.watch(" + JSON.stringify(task.src) + ", " + JSON.stringify(task.tasks) + ");");
    out("});");
  }

  /**
   * Prints out a gulp task for running Karma test runner.
   *
   * @param {Object} task The gulp task
   * @param {Object} task.src The source object of the gulp task
   * @param {Object} task.src.options The options provided to the karma task
   * @inner
   */
  function printKarmaTask(task) {
    out("gulp.task('test', function (done) {");
    out("  karma.start(");
    out(JSON.stringify(task.src.options, null, "  "));
    out("  , done);");
    out("});");
  }

  /**
   * Prints out all the require statements and tasks in gulp format.
   *
   * @method print
   * @memberof module:grunt2gulp~gruntConverter
   * @instance
   */
  this.print = function() {
    printRequire('gulp');
    var needRequiredModules = [];
    for(let x of requires){
      let [needRequire,name]= printRequire(x);
      needRequire && needRequiredModules.push(name)
    }
    
    out(`// npm install ${needRequiredModules.join(" ")} --save-dev`)
    out();
    printExtroCode();
    out();

    for (let x of definitions) {
      printDefinition(x);
    }
    out();
    let needMerge = tasks.find( task => {
      return task.dest !== undefined && is.array(task.dest)
    });
    if(needMerge){
      out('// npm install --save-dev gulp@next merge-stream');
      out("var merge = require('merge-stream');");
      out();
    }

    for (let x of tasks) {
      if (x.name.startsWith('watch')) {
        printWatchTask(x);
      } else if (x.name === 'karma') {
        printKarmaTask(x);
      } else {
        printTask(x);
      }
      out();
    }
  }

  // Grunt API Methods
  /**
   * File object.
   *
   * @memberof module:grunt2gulp~gruntConverter
   * @member {Object} file
   * @instance
   */
  this.file = {
    /**
     * Does nothing.
     */
    readJSON: function(filePath) {
      let thePath = path.resolve(filePath);
      if(fs.existsSync(thePath)){
        return JSON.parse(fs.readFileSync(thePath, 'utf-8'));
      }else{
        return {}
      }
      
    },
    read: function(filePath){
      let thePath = path.resolve(filePath);
      if(fs.existsSync(thePath)){
        return fs.readFileSync(thePath, 'utf-8');
      }else{
        return {}
      }
      
    }
  }

  /**
   * Log object.
   *
   */
  this.log = {};

  /**
   * Processes the given grunt config.
   *
   * @param {Object.<String, Object>} config
   * @see [processGruntConfig]{@link module:grunt2gulp~gruntConverter~processGruntConfig}
   * @method initConfig
   * @memberof module:grunt2gulp~gruntConverter
   * @instance
   */
  this.initConfig = function(config) {
    for (let task in config) {
      if (config.hasOwnProperty(task)) {
        processGruntConfig(task, config[task],config);
      }
    }
  }

  /**
   * Adds the given npm package name to the [requires]{@link
   * module:grunt2gulp~gruntConverter~requires} list. If the prefix
   * 'grunt-contrib-' or 'grunt-' is used in the npmPackageName,
   * removes the prefix and then adds it to the requires list.
   *
   * @param {String} npmPackageName The name of the NPM-installable package
   * @method loadNpmTasks
   * @memberof module:grunt2gulp~gruntConverter
   * @instance
   */
  this.loadNpmTasks = function(npmPackageName) {
    if (gulpExcludedPackages.indexOf(npmPackageName) !== -1) {
    } else if (npmPackageName.indexOf('grunt-contrib-') === 0) {
      requires.push(npmPackageName.slice('grunt-contrib-'.length));
    } else if (npmPackageName.indexOf('grunt-') === 0) {
      requires.push(npmPackageName.slice('grunt-'.length));
    } else {
      requires.push(npmPackageName);
    }
  }

  /**
   * Registers a grunt task
   *
   * @param {String} name The name of the grunt task
   * @param {String[]} dependencies The dependencies of the grunt task
   * @param {Function|null} body Optional function body of the task
   * @method registerTask
   * @memberof module:grunt2gulp~gruntConverter
   * @instance
   */
  this.registerTask = function(name,...args) {
    var task = Object.create(null);
    task.name = name;
    for (let arg of args){
      if(is.array(arg)){
        task.dependencies = arg;
      }else if(is.function(arg)){
        task.body = arg;
      }else if(is.string(arg)){
        task.description = arg;
      }
    }
    
    tasks.push(task);
  }

}

/**
 * Linter for the given Gruntfile.js, scans for anything that will make
 * conversion to gulp an issue. Prints an error message and exits if there are
 * any issues.
 *
 * Assumes the Gruntfile uses UTF-8 encoding.
 * @param {String} gruntFilename
 */
function lintGruntFile(gruntFilename) {
  var data = fs.readFileSync(gruntFilename, 'utf-8');

  exitIfRegexIsFound(/require.*(time-grunt|grunt-timer).*/);
  exitIfRegexIsFound(/(loadTasks.*);/);

  function exitIfRegexIsFound(regex) {
    var match = regex.exec(data);
    if (match) {
      console.log('Please remove "' + match[1] + '" from the Gruntfile.');
      console.log('See the "Known Issues With Gruntfiles" section in the grunt2gulp README.md for more information.');
      process.exit(10);
    }
  }
}

/**
 * Given the full path to a Gruntfile.js file, attempts to convert a
 * Gruntfile into a gulpfile using [gruntConverter]{@link module:grunt2gulp~gruntConverter}.
 *
 * @param {String} filename The Gruntfile to load
 */
function convertGruntFile(filename) {
  var module = require(filename), converter = new gruntConverter(module);
  module(converter);
  converter.print();
}

var gruntFiles = process.argv.slice(2);
if (gruntFiles.length === 0) {
  usage();
} else {
  for (let file of gruntFiles) {
    try {
      var gruntFile = path.resolve(file);
      lintGruntFile(gruntFile);
      convertGruntFile(gruntFile);
    } catch (e) {
      var moduleNameRegex = /Cannot find module '(.*)'/i;
      var moduleName = moduleNameRegex.exec(e.message);
      if (moduleName) {
        if (moduleName[1].indexOf('./') !== -1) {
          console.log('Please move any files imported with a relative into ' +
            'the same directory as the Gruntfile: ' + moduleName[1]);
          process.exit(2);
        } else if (moduleName[1].indexOf('.json') !== -1) {
          console.log('Please create this JSON file: ' + moduleName[1]);
          process.exit(3);
        } else {
          console.log('Please install this module: ' + moduleName[1]);
          process.exit(4);
        }
      } else {
        throw e;
      }
    }
  }
}
