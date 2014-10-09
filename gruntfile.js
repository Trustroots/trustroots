'use strict';

module.exports = function(grunt) {
	// Unified Watch Object
	var watchFiles = {
		serverViews: ['app/views/**/*.*'],
		serverJS: ['gruntfile.js', 'server.js', 'config/**/*.js', 'app/**/*.js'],
		clientViews: ['public/modules/**/views/**/*.html'],
		clientJS: ['public/js/*.js', 'public/modules/**/*.js'],
		clientCSS: ['public/dist/application.css'],
		clientLESS: ['public/less/*.less', 'public/modules/**/less/*.less'],
		mochaTests: ['app/tests/**/*.js']
	};

	// Project Configuration
	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		watch: {
			serverViews: {
				files: watchFiles.serverViews,
				options: {
					livereload: true
				}
			},
			serverJS: {
				files: watchFiles.serverJS,
				tasks: ['jshint'],
				options: {
					livereload: true
				}
			},
			clientViews: {
				files: watchFiles.clientViews,
				options: {
					livereload: true,
				}
			},
			clientJS: {
				files: watchFiles.clientJS,
				tasks: ['jshint'],
				options: {
					livereload: true
				}
			},
			clientLESS: {
				files: watchFiles.clientLESS,
				tasks: ['loadConfig', 'less:development', 'concat:css'],
				options: {
					livereload: true
				}
			}/*,
			clientCSS: {
			  files: watchFiles.clientCSS,
			  tasks: ['csslint'],
			  options: {
			  	livereload: true
			  }
			}*/
		},
		jshint: {
			all: {
				src: watchFiles.clientJS.concat(watchFiles.serverJS),
				options: {
					jshintrc: true
				}
			}
		},
    less: {
      development: {
        options: {
          paths: ['/'],
          compress: false
        },
        files: {
          //'public/dist/application.css': '<%= applicationLESSFiles %>'
          'public/dist/application.css': 'public/less/application.less'
        }
      },
      production: {
        options: {
          paths: ['/'],
          compress: true
        },
        files: {
          //'public/dist/application.css': '<%= applicationLESSFiles %>'
          'public/dist/application.css': 'public/less/application.less'
        }
      }
    },
    concat: {
    	css: {
    		src: watchFiles.clientCSS.concat([
    		    // @todo: should be '<%= applicationCSSFiles %>' instead!
            'public/lib/medium-editor/dist/css/medium-editor.css',
            'public/lib/perfect-scrollbar/src/perfect-scrollbar.css',
            //'public/lib/select2/select2.css',
            //'public/lib/angular-ui-select/dist/select.css',
						'public/lib/leaflet/dist/leaflet.css',
						'public/lib/leaflet.markercluster/dist/MarkerCluster.css'
            ]),
    		dest: 'public/dist/application.min.css',
    	}
    },
		csslint: {
			options: {
				csslintrc: '.csslintrc',
			},
			all: {
				src: 'public/dist/application.min.css'
			}
		},
		uglify: {
			production: {
				options: {
					mangle: false // Angular doesn't like mangle
				},
				files: {
					'public/dist/application.min.js': 'public/dist/application.js'
				}
			}
		},
		nodemon: {
			dev: {
				script: 'server.js',
				options: {
					nodeArgs: ['--debug'],
					ext: 'js,html',
					watch: watchFiles.serverViews.concat(watchFiles.serverJS)
				}
			}
		},
		'node-inspector': {
			custom: {
				options: {
					'web-port': 1337,
					'web-host': 'localhost',
					'debug-port': 5858,
					'save-live-edit': true,
					'no-preload': true,
					'stack-trace-limit': 50,
					'hidden': []
				}
			}
		},
    ngAnnotate: {
      production: {
        files: {
          'public/dist/application.js': '<%= applicationJavaScriptFiles %>'
        }
      }
    },
		concurrent: {
			default: ['nodemon', 'watch'],
			debug: ['nodemon', 'watch', 'node-inspector'],
			options: {
				logConcurrentOutput: true,
				limit: 10
			}
		},
		env: {
			test: {
				NODE_ENV: 'test'
			}
		},
		mochaTest: {
			src: watchFiles.mochaTests,
			options: {
				reporter: 'spec',
				require: 'server.js'
			}
		},
		karma: {
			unit: {
				configFile: 'karma.conf.js'
			}
		}
	});

	// Load NPM tasks
	require('load-grunt-tasks')(grunt);

	// Making grunt default to force in order not to break the project.
	grunt.option('force', true);

	// A Task for loading the configuration object
	grunt.task.registerTask('loadConfig', 'Task that loads the config into a grunt option.', function() {
		var init = require('./config/init')();
		var config = require('./config/config');

		grunt.config.set('applicationJavaScriptFiles', config.assets.js);
		grunt.config.set('applicationCSSFiles', config.assets.lib.css.concat(config.assets.css));
		grunt.config.set('applicationLESSFiles', config.assets.lib.less.concat(config.assets.less) );
	});

	// Default task(s).
	grunt.registerTask('default', ['loadConfig', 'less:development', 'concat:css', 'concurrent:default']);

	// Debug task.
	grunt.registerTask('debug', ['lint', 'concurrent:debug']);

	// Lint task(s).
	grunt.registerTask('lint', ['jshint', 'csslint']);

	// Build task(s).
	grunt.registerTask('build', ['lint', 'loadConfig', 'less', 'concat:css', 'ngAnnotate', 'uglify']);

	// Test task.
	grunt.registerTask('test', ['env:test', 'mochaTest', 'karma:unit']);
};
