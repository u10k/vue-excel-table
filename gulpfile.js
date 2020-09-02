const fs = require('fs');
const version = require('gulp-version-number');
const gulp = require('gulp');
const runSequence = require('run-sequence');
const uglify = require('gulp-uglify');
const minify = require('gulp-minify-css');
const rename = require('gulp-rename');
const header = require('gulp-header');
const del = require('del');
const concat = require('gulp-concat');
const bump = require('gulp-bump');
const git = require('gulp-git');
const nodeCmd = require('node-cmd');
const pkg = require('./package.json');


function getPackageJsonVersion() {
  // 这里我们直接解析 json 文件而不是使用 require，这是因为 require 会缓存多次调用，这会导致版本号不会被更新掉
  return JSON.parse(fs.readFileSync('./package.json', 'utf8')).version;
}

const task = {
  layer() {
    gulp.src(['./src/**/*.css', '!./src/mobile/**/*.css']).pipe(minify({
      compatibility: 'ie7',
    })).pipe(gulp.dest('./dist'));

    return gulp.src(['./src/layer.js', './src/xbim.js'])
      .pipe(version({
        replaces: [
          [/#{VERSION_REPlACE}#/g, getPackageJsonVersion()],
        ],
      }))
      .pipe(concat('xbim.js'))
      .pipe(uglify({
        compress: {
          // drop_console: false, // 显示console
          drop_console: true, // 隐藏console
        },
      }))
      .pipe(header(
        '/*! <%= pkg.realname %>-v<%= pkg.version %> <%= pkg.description %> <%= pkg.license %> License  <%= pkg.homepage %>  By <%= pkg.author %> */\n ;',
        { pkg: JSON.parse(fs.readFileSync('./package.json', 'utf8')) },
      ))
      .pipe(gulp.dest('./dist'));
  },
  // ,mobile: function() {
  //   return gulp.src('./src/mobile/layer.js').pipe(uglify())
  //    .pipe(header('/*! <%= pkg.realname %> mobile-v<%= pkg.mobile %> <%= pkg.description %> <%= pkg.license %> License  <%= pkg.homepage %>mobile  By <%= pkg.author %> */\n ;', {pkg: pkg}))
  //   .pipe(gulp.dest('./dist/mobile'));
  // }
  other() {
    gulp.src('./src/**/*.{png,gif,wav}')
      .pipe(rename({}))
      .pipe(gulp.dest('./dist'));
  },
};

gulp.task('clear', (cb) => // 清理
  del(['./dist/*'], cb));
gulp.task('layer', task.minjs); // 压缩PC版本
// gulp.task('mobile', task.mincss); //压缩Mobile文件
gulp.task('other', task.other); // 移动一些配件

// 打包发行版
const releaseDir = `./release/zip/layer-v${pkg.version}`;
gulp.task('clearZip', (cb) => // 清理
  del(['./release/zip/*'], cb));
gulp.task('r', ['clearZip'], () => {
  gulp.src('./release/doc/**/*')
    .pipe(gulp.dest(releaseDir));

  return gulp.src([
    './dist/**/*',
    '!./dist/**/moon',
    '!./dist/**/moon/*',
  ]).pipe(gulp.dest(`${releaseDir}/layer`));
});

// 全部
gulp.task('default', ['clear'], () => {
  for (const key in task) {
    task[key]();
  }
});

gulp.task('update-patch', () => gulp.src(['./package.json'])
  .pipe(bump({ type: 'patch' }))
  .pipe(gulp.dest('./')));

gulp.task('update-minor', () => gulp.src(['./package.json'])
  .pipe(bump({ type: 'minor' }))
  .pipe(gulp.dest('./')));

gulp.task('update-major', () => gulp.src(['./package.json'])
  .pipe(bump({ type: 'major' }))
  .pipe(gulp.dest('./')));

gulp.task('commit-changes', () => gulp.src('.')
  .pipe(git.add({ args: '-A' }))
  .pipe(git.commit(`[Prerelease] Bumped version number: ${getPackageJsonVersion()}`))
  .pipe(gulp.dest('./')));

gulp.task('create-new-tag', (cb) => {
  // var version = getPackageJsonVersion();
  // git.tag(pkg.version, 'Created Tag for version: ' + version, function (error) {
  git.tag(getPackageJsonVersion(), `Created Tag for version: ${getPackageJsonVersion()}`, (error) => {
    if (error) {
      return cb(error);
    }
    git.push('origin', 'master', { args: '--tags' }, cb);
  });
});

gulp.task('publish', () => {
  nodeCmd.get(
    'cnpm publish',
    (err, data) => {
      console.log('publish success', data);
    },
  );
});

gulp.task('master-publish-patch', (callback) => {
  runSequence(
    'update-patch',
    'default',
    'commit-changes',
    'create-new-tag',
    'publish',
    (error) => {
      if (error) {
        console.log(error.message);
      } else {
        console.log('RELEASE FINISHED SUCCESSFULLY');
      }
      callback(error);
    },
  );
});

gulp.task('master-publish-minor', (callback) => {
  runSequence(
    'update-minor',
    'default',
    'commit-changes',
    'create-new-tag',
    'publish',
    (error) => {
      if (error) {
        console.log(error.message);
      } else {
        console.log('RELEASE FINISHED SUCCESSFULLY');
      }
      callback(error);
    },
  );
});
